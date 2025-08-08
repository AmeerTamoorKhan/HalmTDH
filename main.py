from flask import Flask, render_template, request, Response, stream_with_context
from flask_cors import CORS
from PIL import Image
from ultralytics import YOLO
import numpy as np
import base64
import io
import torch
import traceback
import os
import cv2
import json
from flask import session

COUNTER_FILE = "stats/visitor_count.txt"

def increment_visitor_count():
    if not os.path.exists(COUNTER_FILE):
        with open(COUNTER_FILE, 'w') as f:
            f.write('0')
    with open(COUNTER_FILE, 'r+') as f:
        count = int(f.read())
        count += 1
        f.seek(0)
        f.write(str(count))
        f.truncate()
    return count

app = Flask(__name__)
app.secret_key = 's3cr3t-K3y-For-MyHalmTDH123456!'
CORS(app, resources={r"/*": {"origins": "*"}})

if torch.cuda.is_available():
    print("CUDA is available. Using GPU.")
    torch.cuda.set_device(0)

MODEL_CACHE = {}
MODEL_FILES = {
    ("sepals", "spring_barley"): "spring_barley_sepal.pt",
    ("sepals", "spring_wheat"): "spring_wheat_sepal.pt",
    ("sepals", "winter_rye"): "winter_rye_sepal.pt",
    ("sepals", "winter_triticale"): "winter_triticale_sepal.pt",
    ("sepals", "winter_wheat"): "winter_wheat_sepal.pt",
    ("heads", "spring_barley"): "spring_barley_heads.pt",
    ("heads", "spring_wheat"): "spring_wheat_heads.pt",
    ("heads", "winter_rye"): "winter_rye_heads.pt",
    ("heads", "winter_triticale"): "winter_triticale_heads.pt",
    ("heads", "winter_wheat"): "winter_wheat_heads.pt",
    ("stubble", "default"): "stubble.pt",
}

def load_models():
    for key, filename in MODEL_FILES.items():
        model_path = os.path.join("weights", filename)
        MODEL_CACHE[key] = YOLO(model_path)
        print(f"✅ Loaded model: {filename} on device: {MODEL_CACHE[key].device}")

def pad_patch(patch, target_size=(640, 640)):
    h, w, c = patch.shape
    padded = np.zeros((target_size[1], target_size[0], c), dtype=patch.dtype)
    padded[:h, :w] = patch
    return padded, (target_size[0], target_size[1]), (w, h)

def split_image_into_patches(image_np, patch_size=640):
    patches, positions, original_sizes = [], [], []
    h, w, _ = image_np.shape
    for y in range(0, h, patch_size):
        for x in range(0, w, patch_size):
            patch = image_np[y:y+patch_size, x:x+patch_size]
            padded_patch, _, orig_size = pad_patch(patch, (patch_size, patch_size))
            patches.append(padded_patch)
            positions.append((x, y))
            original_sizes.append(orig_size)
    return patches, positions, original_sizes, (w, h)

def stitch_patches_back(canvas, result_imgs, positions, original_sizes):
    for img, (x, y), (ow, oh) in zip(result_imgs, positions, original_sizes):
        try:
            canvas[y:y+oh, x:x+ow] = img[:oh, :ow]
        except ValueError as e:
            print(f"❌ Stitching error at x:{x}, y:{y} => {e}")
    return canvas

@app.route('/')
def home():
    if not session.get('counted'):
        count = increment_visitor_count()
        session['counted'] = True
    else:
        with open(COUNTER_FILE, 'r') as f:
            count = int(f.read())
    return render_template('index.html', count=count)

@app.route('/sepal')
def sepal():
    if not session.get('counted'):
        count = increment_visitor_count()
        session['counted'] = True
    else:
        with open(COUNTER_FILE, 'r') as f:
            count = int(f.read())
    return render_template('sepals.html', count=count)

@app.route('/head')
def head():
    if not session.get('counted'):
        count = increment_visitor_count()
        session['counted'] = True
    else:
        with open(COUNTER_FILE, 'r') as f:
            count = int(f.read())
    return render_template('heads.html', count=count)

@app.route('/stubble')
def stubble():
    if not session.get('counted'):
        count = increment_visitor_count()
        session['counted'] = True
    else:
        with open(COUNTER_FILE, 'r') as f:
            count = int(f.read())
    return render_template('stubbles.html', count=count)

@app.route('/stream_patches', methods=['POST'])
def stream_patches():
    if 'image' not in request.files or 'crop' not in request.form:
        return {"error": "No image or crop selection found"}, 400

    image_file = request.files['image']
    crop_type = request.form['crop'].strip().lower()
    batch_size = 16
    patch_size = 640

    target_type, crop_name = ("stubble", "default") if crop_type == "stubble" else tuple(crop_type.split('/'))
    model = MODEL_CACHE.get((target_type, crop_name))
    if model is None:
        return {"error": f"Model for {crop_type} not found"}, 400

    try:
        image_bytes = image_file.read()
        image_np = np.array(Image.open(io.BytesIO(image_bytes)).convert('RGB'))
        patches, positions, original_sizes, full_size = split_image_into_patches(image_np)

        # Start with a copy of the original image
        stitched_canvas = image_np.copy()

        def generate():
            total_count = 0
            object_list = []
            object_id = 1
            px_to_cm = 0.0264

            for i in range(0, len(patches), batch_size):
                batch = patches[i:i+batch_size]
                batch_positions = positions[i:i+batch_size]
                batch_sizes = original_sizes[i:i+batch_size]
                result_imgs = []

                results_batch = model(batch, conf=0.1) if target_type == "stubble" else model(batch)


                for idx, results in enumerate(results_batch):
                    px, py = batch_positions[idx]
                    patch_img = batch[idx].copy()

                    masks = results.masks.data.cpu().numpy() if results.masks and results.masks.data is not None else []
                    boxes = results.boxes.xyxy.cpu().numpy() if results.boxes else []
                    confs = results.boxes.conf.cpu().numpy() if results.boxes else []

                    for j in range(len(boxes)):
                        x1, y1, x2, y2 = map(int, boxes[j][:4])
                        conf = float(confs[j])

                        object_info = {
                            "id": object_id,
                            "bbox": [x1 + px, y1 + py, x2 + px, y2 + py],
                            "confidence": round(conf, 3)
                        }

                        if target_type == "heads":
                            cv2.rectangle(stitched_canvas, (x1 + px, y1 + py), (x2 + px, y2 + py), (0, 255, 0), 2)

                        object_list.append(object_info)
                        object_id += 1
                        total_count += 1

                    for j, mask in enumerate(masks):
                        mask_bin = (mask > 0.5).astype(np.uint8)
                        if target_type == "sepals":
                            alpha = 0.5  # 🔧 Set transparency level (0.0 = fully transparent, 1.0 = fully opaque)

                            # Create a red mask with alpha
                            color_mask = np.zeros_like(patch_img, dtype=np.uint8)
                            color_mask[:, :, 0] = mask_bin * 255  # Red channel

                            # Define valid region to overlay
                            h, w = patch_img.shape[:2]
                            h_valid = min(h, stitched_canvas.shape[0] - py)
                            w_valid = min(w, stitched_canvas.shape[1] - px)

                            # Prepare ROI (Region of Interest) from canvas and mask
                            roi = stitched_canvas[py:py+h_valid, px:px+w_valid]
                            mask_roi = color_mask[:h_valid, :w_valid]
                            mask_bin_roi = mask_bin[:h_valid, :w_valid, None]  # Shape: (H, W, 1)

                            # Apply alpha blending only on masked areas
                            blended = roi * (1 - alpha * mask_bin_roi) + mask_roi * (alpha * mask_bin_roi)
                            stitched_canvas[py:py+h_valid, px:px+w_valid] = blended.astype(np.uint8)

                        elif target_type == "stubble":
                            contours, _ = cv2.findContours(mask_bin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                            for contour in contours:
                                if len(contour) >= 5:
                                    ellipse = cv2.fitEllipse(contour)
                                    (cx, cy), (MA, ma), _ = ellipse
                                    cx_global, cy_global = int(cx + px), int(cy + py)
                                    diameter_px = max(MA, ma)
                                    thickness_px = abs(MA - ma) / 2

                                    if MA > 0 and ma > 0:
                                        diameter_cm = round(diameter_px * px_to_cm, 2)
                                        thickness_mm = round(thickness_px * px_to_cm * 10, 2)
                                    else:
                                        diameter_cm = None
                                        thickness_mm = None

                                    object_info = {
                                        "id": object_id,
                                        "ellipse_center": [cx_global, cy_global],
                                        "diameter_cm": diameter_cm,
                                        "thickness_mm": thickness_mm
                                    }

                                    object_list.append(object_info)
                                    total_count += 1

                                    # Offset contour to match global coordinates
                                    contour[:, 0, 0] += px
                                    contour[:, 0, 1] += py
                                    cv2.drawContours(stitched_canvas, [contour], -1, (0, 255, 0), 2)

                                    # 🆕 Draw object number on canvas
                                    cv2.putText(
                                        stitched_canvas,
                                        str(object_id),
                                        (cx_global+8, cy_global+8),
                                        cv2.FONT_HERSHEY_SIMPLEX,
                                        2,
                                        (255, 0, 0),
                                        5,
                                        cv2.LINE_AA
                                    )

                                    object_id += 1


            # ✅ Crop canvas back to original image dimensions
            stitched_canvas_cropped = stitched_canvas[:image_np.shape[0], :image_np.shape[1]]

            # 🔁 Encode final image
            img_buf = io.BytesIO()
            Image.fromarray(stitched_canvas_cropped).save(img_buf, format='PNG')
            img_buf.seek(0)
            b64_img = base64.b64encode(img_buf.read()).decode('utf-8')

            print("Done")
            # Send result to frontend
            yield f"data: {json.dumps({
                'image': f'data:image/png;base64,{b64_img}',
                'count': total_count,
                'objects': object_list
            })}\n\n"

        return Response(stream_with_context(generate()), mimetype='text/event-stream')

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}, 500


print("Model Loading....!!!")
load_models()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
