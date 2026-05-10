Place the face-api.js production model files in this directory before deploying to Vercel:

tiny_face_detector_model-weights_manifest.json
tiny_face_detector_model-shard1
face_expression_model-weights_manifest.json
face_expression_model-shard1

The frontend loads /models first, then falls back to the public face-api.js CDN. Serving these files from
Vercel is the most reliable production setup because it avoids third-party CDN/CORS failures.
