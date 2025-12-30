from ultralytics import YOLO
import os
from PIL import Image

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'yolo11n.pt')

try:
    model = YOLO(MODEL_PATH)
    print("YOLO model loaded successfully.")
except Exception as e:
    print(f"FATAL: Could not load YOLO model. Error: {e}")
    model = None

def get_image_tags(image_path):
    if model is None:
        return ["Error: Model not loaded"]
    try:
        img = Image.open(image_path)
        img.convert('RGB').save(image_path, 'jpeg')
        results = model.predict(image_path, stream = True, conf = 0.65)
        names = model.names
        # Map class name -> highest confidence seen
        detected= {}
        for r in results:
            obbs = getattr(r, 'obb', None)
            if obbs is None:
                obbs = getattr(r, 'boxes', None)
            if not obbs:
                continue
            for obb in obbs:
                try:
                    # different result types expose class/conf differently; handle common shapes
                    if hasattr(obb, 'cls'):
                        cls_val = obb.cls
                        cls_id = int(cls_val[0]) if hasattr(cls_val, '__len__') else int(cls_val)
                    elif hasattr(obb, 'cls_id'):
                        cls_id = int(obb.cls_id)
                    else:
                        continue
                    if hasattr(obb, 'conf'):
                        conf_val = obb.conf
                        conf = float(conf_val[0]) if hasattr(conf_val, '__len__') else float(conf_val)
                    elif hasattr(obb, 'confidence'):
                        conf = float(obb.confidence)
                    else:
                        conf = 0.0
                except Exception:
                    continue
                # Resolve class name from model.names which may be dict or list
                if isinstance(names, dict):
                    class_name = names.get(cls_id, str(cls_id))
                else:
                    class_name = names[cls_id]
                prev_conf = detected.get(class_name, 0.0)
                if conf > prev_conf:
                    detected[class_name] = conf
        # Return list of {name, confidence}
        return [{"name": k, "conf": round(float(v), 2)} for k, v in detected.items()]
    
    except Exception as e:
        print(f"Error processing image with YOLO model: {e}")
        return ["Error"]