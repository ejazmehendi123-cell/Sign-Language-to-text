"""
SanketSetu Preprocessing Pipeline (Python)
Extracts, normalizes, resamples to 30 frames, and computes velocity + mask features.
Guaranteed numeric parity with TypeScript web/src/services/preprocess.ts.
"""

from typing import List, Dict, Any, Tuple
import numpy as np

# Landmark indices
UPPER_BODY_POSE_INDICES = [11, 12, 13, 14, 15, 16]  # shoulders, elbows, wrists
NUM_POSE_KEYPOINTS = len(UPPER_BODY_POSE_INDICES)  # 6 -> 18 coords
NUM_HAND_KEYPOINTS = 21  # 21 -> 63 coords each
SPATIAL_DIM = (NUM_POSE_KEYPOINTS + NUM_HAND_KEYPOINTS * 2) * 3  # 18 + 63 + 63 = 144
TOTAL_FEATURE_DIM = SPATIAL_DIM + SPATIAL_DIM + 3  # 144 coords + 144 velocities + 3 masks = 291
TARGET_FRAMES = 30


def extract_frame_spatial_and_mask(frame: Dict[str, Any]) -> Tuple[np.ndarray, np.ndarray]:
    """
    Extracts normalized coordinates (144 floats) and mask vector (3 floats) from a single frame.
    Normalization: Shoulder midpoint center, Euclidean distance between shoulders as scale.
    """
    pose = frame.get("pose", [])
    left_hand = frame.get("left_hand", [])
    right_hand = frame.get("right_hand", [])
    masks = frame.get("masks", {})

    pose_mask = bool(masks.get("pose", False)) and len(pose) >= 17
    left_mask = bool(masks.get("left_hand", False)) and len(left_hand) == 21
    right_mask = bool(masks.get("right_hand", False)) and len(right_hand) == 21

    # Calculate shoulder center and scale
    if pose_mask:
        p11 = pose[11]
        p12 = pose[12]
        center_x = (p11["x"] + p12["x"]) / 2.0
        center_y = (p11["y"] + p12["y"]) / 2.0
        center_z = (p11.get("z", 0.0) + p12.get("z", 0.0)) / 2.0

        dx = p11["x"] - p12["x"]
        dy = p11["y"] - p12["y"]
        dz = p11.get("z", 0.0) - p12.get("z", 0.0)
        dist = np.sqrt(dx * dx + dy * dy + dz * dz)
        scale = float(dist) if dist > 1e-4 else 1.0
    else:
        center_x, center_y, center_z = 0.5, 0.5, 0.0
        scale = 1.0

    spatial = np.zeros(SPATIAL_DIM, dtype=np.float32)
    offset = 0

    # 1. Upper body pose (6 keypoints * 3)
    if pose_mask:
        for idx in UPPER_BODY_POSE_INDICES:
            lm = pose[idx]
            spatial[offset] = (lm["x"] - center_x) / scale
            spatial[offset + 1] = (lm["y"] - center_y) / scale
            spatial[offset + 2] = (lm.get("z", 0.0) - center_z) / scale
            offset += 3
    else:
        offset += NUM_POSE_KEYPOINTS * 3

    # 2. Left hand (21 keypoints * 3)
    if left_mask:
        for lm in left_hand:
            spatial[offset] = (lm["x"] - center_x) / scale
            spatial[offset + 1] = (lm["y"] - center_y) / scale
            spatial[offset + 2] = (lm.get("z", 0.0) - center_z) / scale
            offset += 3
    else:
        offset += NUM_HAND_KEYPOINTS * 3

    # 3. Right hand (21 keypoints * 3)
    if right_mask:
        for lm in right_hand:
            spatial[offset] = (lm["x"] - center_x) / scale
            spatial[offset + 1] = (lm["y"] - center_y) / scale
            spatial[offset + 2] = (lm.get("z", 0.0) - center_z) / scale
            offset += 3
    else:
        offset += NUM_HAND_KEYPOINTS * 3

    mask_vec = np.array(
        [1.0 if pose_mask else 0.0, 1.0 if left_mask else 0.0, 1.0 if right_mask else 0.0],
        dtype=np.float32,
    )

    return spatial, mask_vec


def resample_temporal_sequence(
    spatial_seq: np.ndarray, mask_seq: np.ndarray, target_len: int = TARGET_FRAMES
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Linearly resamples variable-length temporal sequences to target_len (30) frames.
    spatial_seq: (T, 144)
    mask_seq: (T, 3)
    Returns: (target_len, 144), (target_len, 3)
    """
    T = spatial_seq.shape[0]
    if T == 0:
        return np.zeros((target_len, SPATIAL_DIM), dtype=np.float32), np.zeros(
            (target_len, 3), dtype=np.float32
        )

    if T == 1:
        return np.repeat(spatial_seq, target_len, axis=0), np.repeat(mask_seq, target_len, axis=0)

    resampled_spatial = np.zeros((target_len, SPATIAL_DIM), dtype=np.float32)
    resampled_mask = np.zeros((target_len, 3), dtype=np.float32)

    for j in range(target_len):
        u = j * (T - 1) / float(target_len - 1)
        i0 = int(np.floor(u))
        i1 = min(i0 + 1, T - 1)
        alpha = float(u - i0)

        resampled_spatial[j] = (1.0 - alpha) * spatial_seq[i0] + alpha * spatial_seq[i1]
        resampled_mask[j] = (1.0 - alpha) * mask_seq[i0] + alpha * mask_seq[i1]

    return resampled_spatial, resampled_mask


def compute_velocities(spatial_seq: np.ndarray) -> np.ndarray:
    """
    Computes inter-frame temporal velocities.
    spatial_seq: (target_len, 144)
    Returns: (target_len, 144) where t=0 has velocity 0.0.
    """
    target_len = spatial_seq.shape[0]
    velocities = np.zeros_like(spatial_seq)
    if target_len > 1:
        velocities[1:] = spatial_seq[1:] - spatial_seq[:-1]
    return velocities


def preprocess_take_frames(frames: List[Dict[str, Any]]) -> np.ndarray:
    """
    Full preprocessing pipeline from raw frames list to (30, 291) feature matrix.
    Each frame row contains:
    - 144 normalized spatial coords
    - 144 temporal velocities
    - 3 component masks (pose, left hand, right hand)
    """
    if not frames:
        return np.zeros((TARGET_FRAMES, TOTAL_FEATURE_DIM), dtype=np.float32)

    T = len(frames)
    spatial_list = []
    mask_list = []

    for f in frames:
        s, m = extract_frame_spatial_and_mask(f)
        spatial_list.append(s)
        mask_list.append(m)

    spatial_arr = np.stack(spatial_list, axis=0)  # (T, 144)
    mask_arr = np.stack(mask_list, axis=0)  # (T, 3)

    # Resample to 30 frames
    res_spatial, res_mask = resample_temporal_sequence(spatial_arr, mask_arr, TARGET_FRAMES)

    # Compute velocities
    velocities = compute_velocities(res_spatial)  # (30, 144)

    # Concatenate features along column axis: (30, 144 + 144 + 3) = (30, 291)
    features = np.concatenate([res_spatial, velocities, res_mask], axis=1).astype(np.float32)
    return features


def calculate_motion_energy(prev_frame: Dict[str, Any], curr_frame: Dict[str, Any]) -> float:
    """
    Shared kinetic motion energy metric between two consecutive frames based on wrists & hand roots.
    """
    points_prev = []
    points_curr = []

    # Pose wrists (indices 15, 16)
    pose_prev = prev_frame.get("pose", [])
    pose_curr = curr_frame.get("pose", [])
    masks_prev = prev_frame.get("masks", {})
    masks_curr = curr_frame.get("masks", {})

    if masks_prev.get("pose") and masks_curr.get("pose"):
        if len(pose_prev) > 16 and len(pose_curr) > 16:
            points_prev.append(pose_prev[15])
            points_curr.append(pose_curr[15])
            points_prev.append(pose_prev[16])
            points_curr.append(pose_curr[16])

    # Left hand root (index 0)
    lh_prev = prev_frame.get("left_hand", [])
    lh_curr = curr_frame.get("left_hand", [])
    if masks_prev.get("left_hand") and masks_curr.get("left_hand"):
        if len(lh_prev) > 0 and len(lh_curr) > 0:
            points_prev.append(lh_prev[0])
            points_curr.append(lh_curr[0])

    # Right hand root (index 0)
    rh_prev = prev_frame.get("right_hand", [])
    rh_curr = curr_frame.get("right_hand", [])
    if masks_prev.get("right_hand") and masks_curr.get("right_hand"):
        if len(rh_prev) > 0 and len(rh_curr) > 0:
            points_prev.append(rh_prev[0])
            points_curr.append(rh_curr[0])

    if not points_prev:
        return 0.0

    total_dist = 0.0
    for p0, p1 in zip(points_prev, points_curr):
        dx = p1["x"] - p0["x"]
        dy = p1["y"] - p0["y"]
        dz = p1.get("z", 0.0) - p0.get("z", 0.0)
        total_dist += float(np.sqrt(dx * dx + dy * dy + dz * dz))

    return total_dist / len(points_prev)
