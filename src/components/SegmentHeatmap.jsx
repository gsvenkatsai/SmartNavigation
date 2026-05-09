// SegmentHeatmap.jsx — Community score overlay as colored polylines
// Real-time integration with Firestore segments collection

import { Polyline, Tooltip } from "react-leaflet";
import { useFirestoreCollection } from "../hooks/useFirestore";

/**
 * Determine polyline color based on community score.
 * score = prefer_count - avoid_count
 */
function getSegmentColor(preferCount = 0, avoidCount = 0) {
  const score = preferCount - avoidCount;
  if (score > 10) return "#22c55e"; // green — community preferred
  if (score > -5) return "#eab308";  // yellow — neutral
  return "#ef4444";                  // red — community avoided
}

/**
 * Helper to parse segment ID back into coordinates if they aren't stored as fields
 * Format: seg_lat1_lng1_lat2_lng2
 */
function getCoordsFromId(segmentId) {
  const parts = segmentId.split("_");
  if (parts.length === 5 && parts[0] === "seg") {
    return [
      [parseFloat(parts[1]), parseFloat(parts[2])],
      [parseFloat(parts[3]), parseFloat(parts[4])],
    ];
  }
  return null;
}

export function SegmentHeatmap() {
  const { data: segments, loading } = useFirestoreCollection("segments");

  if (loading) return null;

  return (
    <>
      {segments.map((seg) => {
        // Try to get coords from fields, fallback to parsing ID
        const coords = seg.start_lat && seg.start_lng && seg.end_lat && seg.end_lng
          ? [
              [seg.start_lat, seg.start_lng],
              [seg.end_lat, seg.end_lng],
            ]
          : getCoordsFromId(seg.segment_id);

        if (!coords) return null;

        const preferCount = seg.prefer_count || 0;
        const avoidCount = seg.avoid_count || 0;
        const score = preferCount - avoidCount;
        const color = getSegmentColor(preferCount, avoidCount);

        return (
          <Polyline
            key={seg.id}
            positions={coords}
            pathOptions={{ 
              color, 
              weight: 4, 
              opacity: 0.6,
              lineCap: 'round',
              dashArray: score > 10 ? '1, 5' : null // Dashed for high preference
            }}
          >
            <Tooltip sticky>
              <div className="text-xs font-medium bg-gray-900 text-gray-100 p-1 rounded">
                <div className="font-bold mb-1 border-b border-gray-700 pb-1">
                  Segment: {seg.segment_id}
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-green-400">✓ {preferCount} prefer</span>
                  <span className="text-red-400">✗ {avoidCount} avoid</span>
                </div>
                <div className={`mt-1 font-bold ${score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  Score: {score}
                </div>
                {seg.confidence && (
                  <div className="text-[10px] text-gray-400 mt-1">
                    AI Confidence: {(seg.confidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}
