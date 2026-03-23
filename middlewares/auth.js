const jwt = require("jsonwebtoken");

exports.protect = (roles = []) => {
  return (req, res, next) => {
    try {
      const token = req.cookies.token
      
      if (!token) return res.status(401).json({ message: "you are not logged in" });
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
     req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ message: "Unauthorized", error: err.message });
    }
  };
};
