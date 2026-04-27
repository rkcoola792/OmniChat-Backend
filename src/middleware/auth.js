import jwt from "jsonwebtoken";

function extractToken(req) {
  if (req.cookies?.token) return req.cookies.token;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: "Not authenticated" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Sets req.userId if logged in, but never blocks the request
export function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.id;
    }
  } catch {
    // ignore invalid token — treat as guest
  }
  next();
}
