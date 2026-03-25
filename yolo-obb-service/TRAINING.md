# Train your own YOLO OBB model (label stickers)

This guide assumes you use **Ultralytics YOLOv8-OBB** (same stack as `yolo-obb-service`). You need **images** of your labels and **oriented boxes** drawn around each whole label (one box per sticker).

---

## 1. What you are teaching the model

- **Input:** A photo (tray, holder, single label, etc.).
- **Output:** Rotated rectangles around each **label** (the white/yellow sticker area).
- **One class** is enough, e.g. `label`. More classes only if you need different behaviour per type.

Aim for **50–200+ images** that look like real use (angles, lighting, many vs few labels). More variety → better generalisation.

---

## 2. Annotate oriented boxes

You need tools that export **rotated / oriented** rectangles (not only axis-aligned).

| Tool | Notes |
|------|--------|
| **[Roboflow](https://roboflow.com)** | Easy UI; project with **oriented bounding boxes** → export **YOLOv8 OBB**. |
| **[CVAT](https://www.cvat.ai)** | Yes — use **rotated rectangles** and export **YOLO Ultralytics** (includes OBB). See **Using CVAT** below. |
| **Labelme + conversion** | Possible with scripts; more manual. |

### Using CVAT (instead of Roboflow)

1. Create a task and choose a setup that supports **rotated / oriented** boxes (e.g. **Rotated bounding boxes** or the object detection workflow that lets you rotate shapes — CVAT’s docs: [YOLO Ultralytics format](https://docs.cvat.ai/docs/dataset_management/formats/format-yolo-ultralytics/) covers OBB export).
2. Define one label, e.g. `label`. On each image, draw a **rotated rectangle** around each whole sticker (text + Data Matrix).
3. Split data into **train** / **validation** jobs or subsets as you prefer.
4. **Actions → Export dataset** → format **YOLO Ultralytics 1.1** (or the version CVAT shows that mentions oriented / rotated boxes). You get a zip with `data.yaml`, `images/`, `labels/` and the OBB line format `class x1 y1 x2 y2 x3 y3 x4 y4` (normalized).
5. Unzip, fix **`path:`** in `data.yaml` if needed so it points to the dataset root, then run `yolo obb train data=.../data.yaml ...` as in §5.

If export looks wrong, compare a sample `.txt` label file with [Ultralytics OBB dataset format](https://docs.ultralytics.com/datasets/obb/). CVAT’s YOLO Ultralytics OBB export is meant to match it.

**Tip:** Draw the box **tight around the full label** (text + Data Matrix together), similar to how you want crops for OCR.

### CVAT free plan: annotations only (no “Save images”)

If your plan doesn’t allow exporting images:

1. **Export** from CVAT with format **YOLO Oriented Bounding Boxes 1.0** and **Save images** off. You get a zip (or folder) with only the `.txt` label files (and maybe `data.yaml`).
2. **Put your 56 images** in one folder on your machine. The **filenames must match** what CVAT used (e.g. if CVAT shows `image_001.jpg`, your file must be named `image_001.jpg` or `image_001.png`). If you’re unsure, check the label filenames in the export (e.g. `image_001.txt`) and name your images accordingly.
3. **Merge** annotations and images into a single dataset using the script in this repo:

   ```bash
   cd yolo-obb-service
   python merge_cvat_export.py --cvat-export /path/to/cvat_export.zip --images /path/to/folder_with_56_images --output ./my_dataset
   ```

   This creates `my_dataset/images/train`, `my_dataset/images/val`, `my_dataset/labels/train`, `my_dataset/labels/val`, and `data.yaml` (80% train / 20% val by default; use `--val-ratio 0.2` to change).

4. **Train** as in §5:

   ```bash
   yolo obb train data=my_dataset/data.yaml model=yolov8n-obb.pt epochs=100 imgsz=640 batch=8
   ```

---

## 3. Dataset layout (Ultralytics OBB)

Typical folder structure:

```
dataset/
├── data.yaml
├── images/
│   ├── train/
│   │   ├── img001.jpg
│   │   └── ...
│   └── val/
│       └── ...
└── labels/
    ├── train/
    │   ├── img001.txt
    │   └── ...
    └── val/
        └── ...
```

**`data.yaml`** example (single class `label`):

```yaml
path: /absolute/or/relative/path/to/dataset   # parent of images/
train: images/train
val: images/val

names:
  0: label
```

**Label file** (`labels/train/img001.txt`): one line per oriented box.

Format (Ultralytics **OBB**):  
`class_index x1 y1 x2 y2 x3 y3 x4 y4`  
All coordinates **normalized 0–1** (divide pixel x by image width, pixel y by image height).  
The four points are the corners of the rotated rectangle (order: consistent clockwise or counter-clockwise around the box).

If you export from **Roboflow** as **YOLOv8 OBB**, this usually matches. If something fails at train time, compare your `.txt` lines with [Ultralytics OBB dataset docs](https://docs.ultralytics.com/datasets/obb/).

---

## 4. Install training environment

Use **Python 3.10–3.12** in a venv (same machine or Colab is fine):

```bash
python3.11 -m venv yolo-train
source yolo-train/bin/activate   # Windows: yolo-train\Scripts\activate
pip install ultralytics
```

---

## 5. Train

**Run from inside `yolo-obb-service`** so the `runs/` folder (weights, plots) is created here, not in the project root:

```bash
cd yolo-obb-service
./train.sh my_dataset/data.yaml
```

Or with default `my_dataset_rotated/data.yaml` and extra args: `./train.sh` or `./train.sh my_dataset_rotated/data.yaml epochs=120 degrees=15`.

To run `yolo` yourself (must be from `yolo-obb-service` so `runs/` stays here):

```bash
cd yolo-obb-service
.venv/bin/yolo obb train data=dataset/data.yaml model=yolov8n-obb.pt epochs=100 imgsz=640 batch=8
```

Adjust:

| Argument | Tip |
|----------|-----|
| `model` | `yolov8n-obb.pt` (fast, smaller) → `yolov8s-obb.pt` / `m` if you need more accuracy and have GPU RAM. |
| `epochs` | Start with **100**; watch validation metrics; stop if overfitting. |
| `imgsz` | **640** default; try **1280** if labels are tiny (slower, more VRAM). |
| `batch` | Lower if GPU runs out of memory (e.g. `4` or `2`). |
| `device` | `device=0` for first GPU; `device=cpu` works but is slow. |

Weights are saved under `runs/obb/weights/` (or `runs/obb/train/weights/` if you didn’t use `train.sh` and ran without `project`/`name`):

- **`best.pt`** — use this in production.
- `last.pt` — last epoch.

---

## 6. Try the model locally

```bash
yolo obb predict model=runs/obb/weights/best.pt source=path/to/test_image.jpg
```

Check that boxes land on labels. If many misses, add more varied images and retrain or train longer.

---

## 7. Plug into Label Analyser

Keep a **single canonical weights file** next to the service: `yolo-obb-service/best.pt`. Local runs and Docker/Render use **`YOLO_OBB_WEIGHTS=best.pt`** (no path under `runs/`).

### After training (no manual copy)

- **`./train.sh`** already runs training, then **promotes** the newest `runs/**/weights/best.pt` to **`./best.pt`** when training exits successfully.
- Any time, run **`./sync-best-weights.sh`** to copy the newest run’s `best.pt` to **`./best.pt`**, or pass an explicit file:

  ```bash
  cd yolo-obb-service
  ./sync-best-weights.sh
  ./sync-best-weights.sh runs/obb/weights/best.pt   # optional explicit path
  ./sync-best-weights.sh --dry-run                   # show what would be copied
  ```

### Start the OBB service

```bash
cd yolo-obb-service
# default loads best.pt if present, else yolov8n-obb.pt — set explicitly if you want:
export YOLO_OBB_WEIGHTS=best.pt
# optional: only that class
export YOLO_OBB_CLASS_NAMES=label
./run.sh
```

In the **web app’s** server env (e.g. `server/.env`):

```env
ANALYZE_PIPELINE=yolo-obb
YOLO_OBB_SERVICE_URL=http://127.0.0.1:8766
```

Restart the web app’s Node server. New analyses will use **your** oriented boxes + Gemini on each crop.

---

## 8. Quick checklist

1. Collect representative photos.  
2. Annotate **one OBB per label** with Roboflow (or similar) → export YOLOv8 OBB.  
3. Fix **`data.yaml`** paths and `names`.  
4. Run **`yolo obb train ...`**.  
5. Use **`best.pt`** as **`YOLO_OBB_WEIGHTS`**.

**Official reference:** [Ultralytics OBB](https://docs.ultralytics.com/tasks/obb/) (training args, dataset format, troubleshooting).

---

## Quick horizontal / rotated data (no re-annotation)

### Spiral / circular trays (labels at many angles in one photo)

If the model detects well on one side of the tray but misses the same stickers when they face another direction (e.g. horizontal vs vertical along a spiral), the usual cause is **too few examples at each absolute orientation** in the training set. You do **not** need new labels: rotate **whole images** (and OBB corners) so every cassette appears at **four** orientations across copies of the same shot.

From `yolo-obb-service`:

```bash
.venv/bin/python rotate_dataset.py my_dataset --out my_dataset_rotated
./train.sh my_dataset_rotated/data.yaml epochs=120
```

That turns 51 originals into **51 × 4 = 204** training pairs (plus val). Optionally add small random rotation at train time: `./train.sh my_dataset_rotated/data.yaml epochs=120 degrees=15` (see Ultralytics `yolo obb train` docs for `degrees`).

### Upright-only annotations

If you only have upright annotated images and want detections on **sideways** layouts, synthesize rotated copies the same way:

From `yolo-obb-service`:

```bash
.venv/bin/python rotate_dataset.py my_dataset --out my_dataset_rotated
```

**Note:** `rotate_dataset.py` maps labels using the same geometry as `cv2.rotate` (per-image width/height). If you ever see shifted boxes on `*_rot90` images, delete the old rotated output folder and run the script again (older versions used an incorrect normalized shortcut).

This creates `my_dataset_rotated/` with:
- All original images + labels (copied)
- For each image, three extra files: `..._rot90`, `..._rot180`, `..._rot270` (image + label with corners transformed)

Then train (from `yolo-obb-service` so `runs/` is saved here):

```bash
./train.sh my_dataset_rotated/data.yaml
```

Optional: only add 90° (horizontal from upright): `--angles 90`.

**If the model still doesn’t detect horizontal / rotated in real photos:**

1. **Check that rotated labels are correct**  
   Draw boxes on a rotated image and open the result:
   ```bash
   .venv/bin/python check_rotated_labels.py my_dataset_rotated/images/train/SOME_rot90.jpg
   ```
   Open `images/train/checked/SOME_rot90_with_boxes.jpg` and confirm the green boxes sit on the cassettes. If they’re wrong, the rotation script or paths are off.

2. **Lower inference confidence**  
   At runtime the OBB service may be filtering out low-confidence detections. Restart the service with a lower threshold:
   ```bash
   export YOLO_OBB_CONF=0.10
   ./run.sh
   ```
   Try again on a horizontal image; if detections appear, the model is finding them but with lower confidence.

3. **Train again with rotation augmentation**  
   So the model sees more angles between 0° and 90°:
   ```bash
   ./train.sh my_dataset_rotated/data.yaml epochs=120 degrees=15
   ```
   (`degrees=15` adds small random rotations; OBB supports only 0–90°.)

4. **Real horizontal vs synthetic**  
   Synthetic horizontal = upright image rotated 90°. Real horizontal photos can have different perspective, spacing, and background. If after 1–3 it still fails only on real horizontal shots, add a few real horizontal images (annotate in CVAT/Roboflow) and merge them into the dataset, then retrain.
