import math


def attendance_percentage(attended_classes: int, total_classes: int) -> float:
  if total_classes <= 0:
    return 0.0
  return round((attended_classes / total_classes) * 100, 2)


def remaining_classes_for_target(
    attended_classes: int,
    total_classes: int,
    target_percent: float,
) -> int:
  if target_percent <= 0:
    return 0
  target_ratio = target_percent / 100
  if target_ratio >= 1:
    return 0
  needed = ((target_ratio * total_classes) - attended_classes) / (1 - target_ratio)
  return max(0, math.ceil(needed))


def detect_weak_subjects(
    subject_percentages: dict[int, float],
    threshold_percent: float = 75.0,
) -> list[int]:
  return sorted(
      [subject_id for subject_id, pct in subject_percentages.items() if pct < threshold_percent],
  )

