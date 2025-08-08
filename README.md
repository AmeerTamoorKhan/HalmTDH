# 🌾 HalmTDH - Smart Crop Analysis Tool

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-2.0+-green.svg)](https://flask.palletsprojects.com/)
[![YOLOv11](https://img.shields.io/badge/YOLO-v11-orange.svg)](https://ultralytics.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Available-brightgreen.svg)](https://halmtdh.atkhan.info/)

> **HalmTDH** is a state-of-the-art image analysis tool that revolutionizes crop phenotyping through computer vision. Built for researchers, breeders, and agronomists, it provides real-time analysis of crop development directly from field images.

## 🚀 **Live Demo**
Experience HalmTDH in action: **[https://halmtdh.atkhan.info/](https://halmtdh.atkhan.info/)**

---

## ✨ **Features**

### 🎯 **Multi-Crop Analysis**
- **Sepal Detection**: Instance segmentation for precise leaf counting
- **Head Detection**: Object detection for grain head identification  
- **Stubble Analysis**: Diameter and thickness measurement of crop stubble

### 🌱 **Supported Crops**
- Spring Barley & Spring Wheat
- Winter Wheat, Winter Rye & Winter Triticale
- Extensible framework for additional crops

### ⚡ **Real-Time Processing**
- Streaming patch-by-patch analysis
- Live progress updates during processing
- GPU-accelerated inference with CUDA support

### 📊 **Detailed Analytics**
- Accurate object counting with confidence scores
- Morphological measurements (diameter, thickness)
- Exportable results with bounding box coordinates

---

## 🛠️ **Installation & Setup**

### **Prerequisites**
- Python 3.8 or higher
- CUDA-compatible GPU (recommended)
- 4GB+ RAM

### **1. Clone Repository**
```bash
git clone https://github.com/yourusername/halmtdh.git
cd halmtdh
```

### **2. Install Dependencies**
```bash
pip install -r requirements.txt
```

### **3. Download Model Weights**
Create a `weights/` directory and download the pre-trained models:

**Sepal Models (Instance Segmentation):**
- Spring Barley Sepal → `weights/spring_barley_sepal.pt`
- Spring Wheat Sepal → `weights/spring_wheat_sepal.pt`
- Winter Wheat Sepal → `weights/winter_wheat_sepal.pt`
- Winter Rye Sepal → `weights/winter_rye_sepal.pt`
- Winter Triticale Sepal → `weights/winter_triticale_sepal.pt`

**Head Models (Object Detection):**
- Spring Barley Head → `weights/spring_barley_heads.pt`
- Spring Wheat Head → `weights/spring_wheat_heads.pt`
- Winter Wheat Head → `weights/winter_wheat_heads.pt`
- Winter Rye Head → `weights/winter_rye_heads.pt`
- Winter Triticale Head → `weights/winter_triticale_heads.pt`

**Stubble Model:**
- Stubble Analysis → `weights/stubble.pt`

### **4. Create Directory Structure**
```
halmtdh/
├── main.py
├── requirements.txt
├── weights/
│   ├── spring_barley_sepal.pt
│   ├── spring_wheat_sepal.pt
│   └── ... (other model files)
├── templates/
├── static/
└── stats/
```

### **5. Run the Application**
```bash
python main.py
```

The application will be available at `http://localhost:5000`

---

## 🎮 **How to Use**

### **Step 1: Choose Analysis Type**
- **Sepal Analysis**: Count and segment individual leaves
- **Head Analysis**: Detect and count grain heads
- **Stubble Analysis**: Measure stubble dimensions

### **Step 2: Select Crop Type**
Choose from the supported crop varieties (Spring/Winter × Barley/Wheat/Rye/Triticale)

### **Step 3: Upload Image**
Upload your field image (JPEG, PNG supported)

### **Step 4: Real-Time Processing**
Watch as HalmTDH processes your image patch by patch, providing:
- Live progress updates
- Running object count
- Annotated results

### **Step 5: Download Results**
Export annotated images and detailed analytics, including:
- Object counts and confidence scores
- Bounding box coordinates
- Morphological measurements

---

## 🏗️ **Architecture**

### **Backend (Flask)**
- RESTful API with real-time streaming
- GPU-accelerated YOLO inference
- Patch-based processing for large images
- Session management and visitor tracking

### **Computer Vision Pipeline**
1. **Image Preprocessing**: Patch splitting and padding
2. **Model Inference**: YOLOv11-based detection/segmentation
3. **Post-processing**: Result stitching and annotation
4. **Streaming Response**: Real-time progress updates

### **Model Architecture**
- **Instance Segmentation**: YOLOv11 for sepal analysis
- **Object Detection**: YOLOv11 for head counting
- **Morphological Analysis**: Ellipse fitting for stubble measurements

---

## 📊 **Datasets**

All datasets are available for research purposes:

### **Sepal Count Datasets (Instance Segmentation)**
| Crop | Dataset Link |
|------|-------------|
| Spring Barley | [Download](https://drive.google.com/file/d/1PHgJ-C2h-tbYmMi8_VRDtcs9DglH8nKT) |
| Spring Wheat | [Download](https://drive.google.com/file/d/13VOjCfk0Gw-iiLQMprlznKzjNrAJnp5c) |
| Winter Wheat | [Download](https://drive.google.com/file/d/17kyw6R4mujj9dfjSTnAHEsQDEus2JTPB) |
| Winter Rye | [Download](https://drive.google.com/file/d/1d0cKpeEYv3Rw6FXnbeBUZZ6xRTCjqLn3) |
| Winter Triticale | [Download](https://drive.google.com/file/d/1AeULbjpYTlgPxaz3z0HgvsbR6GAIcrD2) |

### **Head Count Datasets (Object Detection)**
| Crop | Dataset Link |
|------|-------------|
| Spring Barley | [Download](https://drive.google.com/file/d/1OhGDlWq4HJi8P1CnFiMksL2v2LOUHKQN) |
| Spring Wheat | [Download](https://drive.google.com/file/d/1oAOeVFIGePffaJji6FTrQW39BFQx5R4n) |
| Winter Wheat | [Download](https://drive.google.com/file/d/1VBNuLDuM4rbd7-yEAh-9Qvy9GMLI6lOp) |
| Winter Rye | [Download](https://drive.google.com/file/d/1AnvlKpwYxYEpqBzFrlIdqvmiHOgrgGow) |
| Winter Triticale | [Download](https://drive.google.com/file/d/1EclmepPAiS-T2vO9OxHLk7cWs4d8LDry) |

---

## 📋 **Requirements**

```
opencv-python
matplotlib
flask
flask-cors
gunicorn
ultralytics
```

---

## 🔬 **Research & Publications**

HalmTDH is backed by cutting-edge research in agricultural computer vision:

```bibtex
@article{khan2025leaf,
  title={LEAF-Net: A unified framework for leaf extraction and analysis in multi-crop phenotyping using YOLOv11},
  author={Khan, Ameer Tamoor and Jensen, Signe Marie},
  journal={Agriculture},
  volume={15},
  number={2},
  pages={196},
  year={2025},
  publisher={MDPI}
}

@article{khan2025barley,
  title={Barley Head Detection Using UAV Imagery and YOLOv10},
  author={Khan, Ameer Tamoor and Azim, Saiful and Jensen, Signe Marie},
  year={2025}
}
```

---

## 🤝 **Contributing**

We welcome contributions to HalmTDH! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### **Development Setup**
```bash
# Install development dependencies
pip install -r requirements.txt

# Run in development mode
python main.py
```

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **YOLO Team** for the outstanding object detection framework
- **Ultralytics** for YOLOv11 implementation

---

## 📞 **Support & Contact**
- **Email**: drop-in@atkhan.info

---

<div align="center">

*Made with ❤️ for the agricultural research community*

</div>
