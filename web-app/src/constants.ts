export const POSTURE_DATA: Record<string, any> = {
  "normal_idle": {
    title: "STABLE POSTURE",
    subtitle: "Normal idle",
    alert: "POSTURE OK  •  KEEP A NEUTRAL SPINE  •  RELAX YOUR SHOULDERS",
    reminder: "Maintain your head in a neutral position, relax both shoulders, and change posture periodically.",
    affected: "No significant warning areas",
    safe: true
  },
  "bad_posture": {
    title: "SLOUCHING / BAD POSTURE",
    subtitle: "Bad posture detected",
    alert: "POSTURE ALERT  •  NECK AND UPPER-BACK LOAD DETECTED  •  SIT TALL",
    reminder: "Gently bring your head back, open your shoulders, and lean back. Avoid overarching.",
    affected: "Neck • Trapezius • Shoulders • Upper back",
    safe: false
  },
  "bending": {
    title: "BENDING",
    subtitle: "Bending detected",
    alert: "BENDING ALERT  •  REDUCE PROLONGED FORWARD FLEXION  •  RESET POSTURE",
    reminder: "Reduce continuous bending time. When standing up, keep movements slow and controlled.",
    affected: "Neck • Mid back • Lower back",
    safe: false
  },
  "lifting_wrong_back": {
    title: "UNSAFE LIFTING",
    subtitle: "Unsafe back lifting pattern",
    alert: "LIFTING ALERT  •  LOAD ON LOWER BACK  •  STOP AND RESET YOUR FORM",
    reminder: "Stop the movement, bring the object close to your body, and use your legs. Do not twist your torso while lifting.",
    affected: "Erector spinae • Mid back • Lower back",
    safe: false
  },
  "shoulder_asymmetry": {
    title: "SHOULDER ASYMMETRY",
    subtitle: "Shoulder asymmetry detected",
    alert: "SHOULDER ALERT  •  UNEVEN SHOULDER POSITION  •  RELAX AND RE-CENTER",
    reminder: "Relax your arms, level your shoulders, and avoid carrying loads on one side for too long.",
    affected: "Trapezius • Left/Right shoulders • Scapula area",
    safe: false
  }
};
