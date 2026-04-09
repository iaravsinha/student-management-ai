def estimate_subject_risk(attendance_pct: float) -> str:
  if attendance_pct >= 85:
    return "low"
  if attendance_pct >= 70:
    return "medium"
  return "high"


def build_subject_risk_map(subject_percentages: dict[int, float]) -> dict[int, str]:
  return {subject_id: estimate_subject_risk(pct) for subject_id, pct in subject_percentages.items()}

