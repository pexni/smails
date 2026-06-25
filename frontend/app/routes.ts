import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("mcp", "routes/mcp.tsx"),
  route("email-api", "routes/api.tsx"),
  route("otp", "routes/otp.tsx"),
] satisfies RouteConfig;
