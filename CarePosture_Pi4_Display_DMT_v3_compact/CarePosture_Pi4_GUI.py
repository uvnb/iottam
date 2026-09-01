"""CarePosture display for Raspberry Pi 4 - Team DMT.

Future AI/BLE code only needs to call:
    app.receive_posture_command("bad_posture")

This GUI is a posture-awareness aid, not a medical diagnostic device.
"""
from __future__ import annotations

import math
import queue
import sys
import tkinter as tk
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageTk


APP_DIR = Path(__file__).resolve().parent
IMAGE_PATH = APP_DIR / "back_muscles.png"
ANIMATION_MS = 70
PULSE_FRAMES = 14
C = {
    "bg": "#071019", "panel": "#0D1924", "panel2": "#10212E",
    "border": "#22384A", "cyan": "#34D6E8", "green": "#46E39A",
    "red": "#FF3B4F", "orange": "#FFB347", "text": "#F4F8FB",
    "muted": "#8FA6B8",
}


@dataclass(frozen=True)
class Posture:
    title: str
    subtitle: str
    alert: str
    reminder: str
    affected: str
    regions: tuple[str, ...]
    safe: bool = False


POSTURES = {
    "normal_idle": Posture(
        "TƯ THẾ ỔN ĐỊNH", "Normal idle",
        "POSTURE OK  •  KEEP A NEUTRAL SPINE  •  RELAX YOUR SHOULDERS",
        "Duy trì đầu ở vị trí trung tính, thả lỏng hai vai và đổi tư thế định kỳ.",
        "Không có vùng cảnh báo nổi bật", (), True,
    ),
    "bad_posture": Posture(
        "TƯ THẾ GÙ / NGỒI SAI", "Bad posture detected",
        "POSTURE ALERT  •  NECK AND UPPER-BACK LOAD DETECTED  •  SIT TALL",
        "Nhẹ nhàng đưa đầu về sau, mở vai và tựa lưng. Không cố ưỡn quá mức.",
        "Cổ gáy • cơ thang • vai • lưng trên",
        ("neck", "left_shoulder", "right_shoulder", "upper_back", "mid_back"),
    ),
    "bending": Posture(
        "CÚI NGƯỜI", "Bending detected",
        "BENDING ALERT  •  REDUCE PROLONGED FORWARD FLEXION  •  RESET POSTURE",
        "Rút ngắn thời gian cúi liên tục. Khi đứng lên, giữ chuyển động chậm và có kiểm soát.",
        "Cổ gáy • lưng giữa • vùng thắt lưng",
        ("neck", "upper_back", "mid_back", "lower_back"),
    ),
    "lifting_wrong_back": Posture(
        "NÂNG VẬT SAI TƯ THẾ", "Unsafe back lifting pattern",
        "LIFTING ALERT  •  LOAD ON LOWER BACK  •  STOP AND RESET YOUR FORM",
        "Dừng động tác, đưa vật sát người và dùng chân hỗ trợ. Không xoay thân khi đang nâng.",
        "Cơ dựng sống • lưng giữa • thắt lưng", ("mid_back", "lower_back"),
    ),
    "shoulder_asymmetry": Posture(
        "LỆCH VAI", "Shoulder asymmetry detected",
        "SHOULDER ALERT  •  UNEVEN SHOULDER POSITION  •  RELAX AND RE-CENTER",
        "Thả lỏng tay, cân lại hai vai và tránh mang tải lâu ở một bên.",
        "Cơ thang • vai trái/phải • quanh xương bả vai",
        ("neck", "left_shoulder", "right_shoulder", "upper_back"),
    ),
}

ALIASES = {
    "0": "normal_idle", "normal": "normal_idle", "idle": "normal_idle", "p0": "normal_idle",
    "1": "bad_posture", "bad": "bad_posture", "p1": "bad_posture",
    "2": "bending", "bend": "bending", "p2": "bending",
    "3": "lifting_wrong_back", "lifting": "lifting_wrong_back", "p3": "lifting_wrong_back",
    "4": "normal_idle", "5": "shoulder_asymmetry", "shoulder": "shoulder_asymmetry",
    "p4": "shoulder_asymmetry",
}


def normalize_command(command: object) -> str | None:
    """Convert a BLE string/bytes/short code into one of the five labels."""
    if isinstance(command, bytes):
        command = command.decode("utf-8", errors="ignore")
    key = str(command).strip().lower().replace(" ", "_")
    key = ALIASES.get(key, key)
    return key if key in POSTURES else None


class MuscleRenderer:
    """Build pulse frames once, then the animation only swaps cached images."""
    # 1.00 = original polygon size. 0.78 keeps each warning patch compact.
    MASK_SCALE = 0.78
    # Compact warning masks fitted to the bundled 591x642 anatomical image.
    # Keep these masks close to the visible muscle groups so the red pulse does
    # not cover a whole body section.
    REGIONS = {
        "neck": (
            ((229, 12), (279, 8), (280, 137), (253, 163), (216, 112)),
            ((362, 12), (312, 8), (311, 137), (338, 163), (375, 112)),
        ),
        "left_shoulder": (
            ((78, 183), (153, 153), (218, 178), (209, 241), (171, 276), (105, 248)),
        ),
        "right_shoulder": (
            ((513, 183), (438, 153), (373, 178), (382, 241), (420, 276), (486, 248)),
        ),
        "upper_back": (
            ((166, 166), (272, 183), (278, 326), (230, 377), (170, 286)),
            ((425, 166), (319, 183), (313, 326), (361, 377), (421, 286)),
        ),
        "mid_back": (
            ((197, 304), (276, 326), (279, 447), (244, 481), (198, 414)),
            ((394, 304), (315, 326), (312, 447), (347, 481), (393, 414)),
        ),
        "lower_back": (
            ((229, 386), (280, 403), (280, 506), (253, 531), (220, 478)),
            ((362, 386), (311, 403), (311, 506), (338, 531), (371, 478)),
        ),
    }

    def __init__(self, path: Path):
        if not path.exists():
            raise FileNotFoundError(f"Không tìm thấy ảnh: {path}")
        self.base = Image.open(path).convert("RGBA")
        self.frames: list[ImageTk.PhotoImage] = []
        self.render_size = (0, 0)
        self.regions: tuple[str, ...] = ()

    def compose(self, regions: tuple[str, ...], alpha: int) -> Image.Image:
        result = self.base.copy()
        if not regions:
            return result
        mask = Image.new("L", self.base.size, 0)
        draw = ImageDraw.Draw(mask)
        for region in regions:
            for polygon in self.REGIONS.get(region, ()):
                center_x = sum(point[0] for point in polygon) / len(polygon)
                center_y = sum(point[1] for point in polygon) / len(polygon)
                compact_polygon = tuple(
                    (
                        round(center_x + (point[0] - center_x) * self.MASK_SCALE),
                        round(center_y + (point[1] - center_y) * self.MASK_SCALE),
                    )
                    for point in polygon
                )
                draw.polygon(compact_polygon, fill=alpha)
        # A compact halo remains visible on the Pi display without spilling far
        # beyond the selected muscle group.
        glow_mask = mask.filter(ImageFilter.GaussianBlur(8))
        glow = Image.new("RGBA", self.base.size, (255, 8, 32, 0))
        glow.putalpha(glow_mask.point(lambda x: min(140, int(x * 0.68))))
        result = Image.alpha_composite(result, glow)
        core = Image.new("RGBA", self.base.size, (255, 18, 45, 0))
        core.putalpha(mask)
        return Image.alpha_composite(result, core)

    def build(self, canvas_size: tuple[int, int], regions: tuple[str, ...]):
        width, height = canvas_size
        if width < 40 or height < 40:
            return
        scale = min(width / self.base.width, height / self.base.height)
        size = (int(self.base.width * scale), int(self.base.height * scale))
        if size == self.render_size and regions == self.regions and self.frames:
            return
        self.render_size, self.regions = size, regions
        self.frames.clear()
        for i in range(PULSE_FRAMES):
            phase = (math.sin(i / PULSE_FRAMES * math.tau - math.pi / 2) + 1) / 2
            alpha = int(45 + phase * 145) if regions else 0
            picture = self.compose(regions, alpha).resize(size, Image.Resampling.LANCZOS)
            self.frames.append(ImageTk.PhotoImage(picture))


class CarePostureApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("CarePosture - Team DMT")
        self.geometry("1024x600")
        self.minsize(800, 480)
        self.configure(bg=C["bg"])
        self.renderer = MuscleRenderer(IMAGE_PATH)
        self.command_queue: queue.Queue[str] = queue.Queue()
        self.state_key = "normal_idle"
        self.frame_index = 0
        self.marquee_x = 0
        self.resize_job = None
        self.fullscreen = False
        self.build_layout()
        self.bind_controls()
        self.set_posture("normal_idle")
        self.after(ANIMATION_MS, self.animate)
        self.after(50, self.poll_commands)

    def panel(self, parent):
        return tk.Frame(parent, bg=C["panel"], highlightbackground=C["border"],
                        highlightthickness=1, bd=0)

    def build_layout(self):
        # 1) Header
        header = tk.Frame(self, bg=C["panel"], height=68)
        header.pack(fill="x", padx=12, pady=(10, 8))
        header.pack_propagate(False)
        tk.Label(header, text="CAREPOSTURE", bg=C["panel"], fg=C["cyan"],
                 font=("DejaVu Sans", 21, "bold")).pack(side="left", padx=(18, 9))
        tk.Label(header, text="AIoT SMART POSTURE SHIRT", bg=C["panel"], fg=C["muted"],
                 font=("DejaVu Sans", 10, "bold")).pack(side="left", pady=(8, 0))
        self.command_status = tk.Label(header, text="AI COMMAND READY", bg=C["panel2"],
                                       fg=C["green"], font=("DejaVu Sans Mono", 9, "bold"),
                                       padx=12, pady=7)
        self.command_status.pack(side="right", padx=16)

        body = tk.Frame(self, bg=C["bg"])
        body.pack(fill="both", expand=True, padx=12, pady=(0, 11))
        body.grid_rowconfigure(0, weight=1)
        body.grid_columnconfigure(0, weight=64)
        body.grid_columnconfigure(1, weight=36)

        # 2) Large anatomical image
        visual = self.panel(body)
        visual.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        visual.grid_rowconfigure(2, weight=1)
        visual.grid_columnconfigure(0, weight=1)
        strip = tk.Frame(visual, bg=C["panel"])
        strip.grid(row=0, column=0, sticky="ew", padx=14, pady=(11, 4))
        self.posture_title = tk.Label(strip, bg=C["panel"], fg=C["green"],
                                      font=("DejaVu Sans", 17, "bold"), anchor="w")
        self.posture_title.pack(side="left")
        self.posture_subtitle = tk.Label(strip, bg=C["panel"], fg=C["muted"],
                                         font=("DejaVu Sans", 9), anchor="e")
        self.posture_subtitle.pack(side="right", pady=(5, 0))
        self.marquee = tk.Canvas(visual, height=30, bg="#09131C", highlightthickness=0)
        self.marquee.grid(row=1, column=0, sticky="ew", padx=14)
        self.marquee_text_id = self.marquee.create_text(
            0, 15, fill=C["green"], anchor="w", font=("DejaVu Sans Mono", 10, "bold"))
        self.body_canvas = tk.Canvas(visual, bg="#10171D", highlightthickness=0)
        self.body_canvas.grid(row=2, column=0, sticky="nsew", padx=14, pady=(8, 12))
        self.body_image_id = self.body_canvas.create_image(0, 0, anchor="center")
        self.body_canvas.bind("<Configure>", self.on_resize)

        right = tk.Frame(body, bg=C["bg"])
        right.grid(row=0, column=1, sticky="nsew")
        right.grid_rowconfigure(0, weight=56)
        right.grid_rowconfigure(1, weight=44)
        right.grid_columnconfigure(0, weight=1)

        # 3) Reminder
        reminder = self.panel(right)
        reminder.grid(row=0, column=0, sticky="nsew", pady=(0, 8))
        tk.Label(reminder, text="POSTURE REMINDER", bg=C["panel"], fg=C["cyan"],
                 font=("DejaVu Sans", 12, "bold"), anchor="w").pack(fill="x", padx=16, pady=(15, 7))
        self.reminder_text = tk.Label(reminder, bg=C["panel"], fg=C["text"],
                                      font=("DejaVu Sans", 11), justify="left", anchor="nw",
                                      wraplength=305)
        self.reminder_text.pack(fill="both", expand=True, padx=16, pady=(3, 6))
        tk.Label(reminder, text="VÙNG CÓ THỂ CHỊU TẢI", bg=C["panel"], fg=C["muted"],
                 font=("DejaVu Sans", 8, "bold"), anchor="w").pack(fill="x", padx=16, pady=(0, 3))
        self.affected_text = tk.Label(reminder, bg=C["panel"], fg=C["orange"],
                                      font=("DejaVu Sans", 10, "bold"), justify="left",
                                      anchor="nw", wraplength=305)
        self.affected_text.pack(fill="x", padx=16, pady=(0, 13))

        # 4) Future camera training feature
        training = self.panel(right)
        training.grid(row=1, column=0, sticky="nsew")
        tk.Label(training, text="CAMERA TRAINING", bg=C["panel"], fg=C["cyan"],
                 font=("DejaVu Sans", 12, "bold"), anchor="w").pack(fill="x", padx=16, pady=(14, 5))
        preview = tk.Canvas(training, height=66, bg="#08131C", highlightthickness=0)
        preview.pack(fill="x", padx=16, pady=(4, 6))
        preview.create_rectangle(12, 10, 75, 56, outline=C["border"], width=2)
        preview.create_oval(34, 22, 52, 40, outline=C["cyan"], width=2)
        preview.create_line(43, 40, 43, 50, fill=C["cyan"], width=2)
        preview.create_text(92, 25, text="EXERCISE DETECTION", fill=C["text"], anchor="w",
                            font=("DejaVu Sans", 9, "bold"))
        preview.create_text(92, 44, text="Development slot reserved", fill=C["muted"], anchor="w",
                            font=("DejaVu Sans", 8))
        tk.Label(training, text="COMING SOON", bg=C["panel2"], fg=C["orange"],
                 font=("DejaVu Sans Mono", 9, "bold"), pady=5).pack(fill="x", padx=16, pady=(0, 6))
        tk.Label(training, text="Demo: phím 1–5  |  F11: toàn màn hình  |  Esc: thoát",
                 bg=C["panel"], fg=C["muted"], font=("DejaVu Sans", 8)).pack(
                     fill="x", padx=16, pady=(0, 10))

    def bind_controls(self):
        order = ["bad_posture", "bending", "lifting_wrong_back", "normal_idle", "shoulder_asymmetry"]
        for index, name in enumerate(order, 1):
            self.bind(str(index), lambda _event, value=name: self.set_posture(value))
        self.bind("<F11>", self.toggle_fullscreen)
        self.bind("<Escape>", self.escape)

    def receive_posture_command(self, command: object) -> bool:
        """Thread-safe integration point for the future BLE receiver/AI process."""
        key = normalize_command(command)
        if key is None:
            return False
        self.command_queue.put(key)
        return True

    def poll_commands(self):
        """Move predictions from a future worker thread onto Tk's UI thread."""
        newest = None
        try:
            while True:
                newest = self.command_queue.get_nowait()
        except queue.Empty:
            pass
        if newest is not None:
            self.set_posture(newest)
        self.after(50, self.poll_commands)

    def set_posture(self, command: object) -> bool:
        key = normalize_command(command)
        if key is None:
            self.command_status.configure(text="UNKNOWN COMMAND", fg=C["orange"])
            return False
        self.state_key = key
        state = POSTURES[key]
        color = C["green"] if state.safe else C["red"]
        self.posture_title.configure(text=state.title, fg=color)
        self.posture_subtitle.configure(text=state.subtitle.upper())
        self.reminder_text.configure(text=state.reminder)
        self.affected_text.configure(text=state.affected,
                                     fg=C["green"] if state.safe else C["orange"])
        self.command_status.configure(text=f"COMMAND: {key.upper()}", fg=color)
        self.marquee.itemconfigure(self.marquee_text_id, text=state.alert, fill=color)
        self.marquee_x = self.marquee.winfo_width()
        self.frame_index = 0
        self.renderer.frames.clear()
        self.rebuild_frames()
        return True

    def on_resize(self, _event):
        if self.resize_job is not None:
            self.after_cancel(self.resize_job)
        self.resize_job = self.after(120, self.rebuild_frames)

    def rebuild_frames(self):
        self.resize_job = None
        state = POSTURES[self.state_key]
        self.renderer.build((self.body_canvas.winfo_width(), self.body_canvas.winfo_height()),
                            state.regions)
        self.show_frame()

    def show_frame(self):
        if not self.renderer.frames:
            return
        image = self.renderer.frames[self.frame_index % len(self.renderer.frames)]
        self.body_canvas.itemconfigure(self.body_image_id, image=image)
        self.body_canvas.coords(self.body_image_id, self.body_canvas.winfo_width() / 2,
                                self.body_canvas.winfo_height() / 2)

    def animate(self):
        if self.renderer.frames:
            self.frame_index = (self.frame_index + 1) % len(self.renderer.frames)
            self.show_frame()
        bbox = self.marquee.bbox(self.marquee_text_id)
        text_width = bbox[2] - bbox[0] if bbox else 400
        self.marquee_x -= 2
        if self.marquee_x < -text_width:
            self.marquee_x = self.marquee.winfo_width()
        self.marquee.coords(self.marquee_text_id, self.marquee_x, 15)
        self.after(ANIMATION_MS, self.animate)

    def toggle_fullscreen(self, _event=None):
        self.fullscreen = not self.fullscreen
        self.attributes("-fullscreen", self.fullscreen)

    def escape(self, _event=None):
        if self.fullscreen:
            self.fullscreen = False
            self.attributes("-fullscreen", False)
        else:
            self.destroy()


def main():
    initial = sys.argv[1] if len(sys.argv) > 1 else "normal_idle"
    app = CarePostureApp()
    app.set_posture(initial)
    app.mainloop()


if __name__ == "__main__":
    main()
