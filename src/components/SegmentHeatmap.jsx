// SegmentHeatmap.jsx — Community score overlay as colored polylines
import { useState, useEffect, useRef } from "react";
import { Polyline, Tooltip } from "react-leaflet";
import { useFirestoreCollection } from "../hooks/useFirestore";
import { fetchSegmentGeometry } from "../services/orsService";

const geoCache = new Map();

function getSegmentColor(preferCount = 0, avoidCount = 0) {
  const score = preferCount - avoidCount;
  if (score > 10) return "#22c55e";
  if (score > -5) return "#eab308";
  return "#ef4444";
}

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
  const [snapped, setSnapped] = useState({});
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!segments?.length) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    async function fetchAll() {
      for (const seg of segments) {
        if (geoCache.has(seg.id)) {
          setSnapped(prev => ({ ...prev, [seg.id]: geoCache.get(seg.id) }));
          continue;
        }
        const rawCoords =
          seg.start_lat && seg.start_lng && seg.end_lat && seg.end_lng
            ? { startLat: seg.start_lat, startLng: seg.start_lng,
                endLat: seg.end_lat,     endLng: seg.end_lng }
            : (() => {
                const c = getCoordsFromId(seg.segment_id);
                return c ? { startLat: c[0][0], startLng: c[0][1],
                             endLat: c[1][0],   endLng: c[1][1] }
                         : null;
              })();
        if (!rawCoords) continue;

        await new Promise(r => setTimeout(r, 800));

        const positions = await fetchSegmentGeometry(
          rawCoords.startLat, rawCoords.startLng,
          rawCoords.endLat,   rawCoords.endLng
        );
        const final = positions ?? [
          [rawCoords.startLat, rawCoords.startLng],
          [rawCoords.endLat,   rawCoords.endLng],
        ];
        geoCache.set(seg.id, final);
        setSnapped(prev => ({ ...prev, [seg.id]: final }));
      }
      fetchingRef.current = false;
    }

    fetchAll();
  }, [segments]);

  if (loading) return null;

  return (
    <>
      {segments.map((seg) => {
        const coords = snapped[seg.id] ??
          (seg.start_lat && seg.start_lng && seg.end_lat && seg.end_lng
            ? [[seg.start_lat, seg.start_lng], [seg.end_lat, seg.end_lng]]
            : getCoordsFromId(seg.segment_id));

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
              lineCap: "round",
              dashArray: score > 10 ? "1, 5" : null,
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
                <div className={`mt-1 font-bold ${score >= 0 ? "text-green-400" : "text-red-400"}`}>
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