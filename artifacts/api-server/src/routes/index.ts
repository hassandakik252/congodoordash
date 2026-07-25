import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import restaurantsRouter from "./restaurants";
import ordersRouter from "./orders";
import usersRouter from "./users";
import notificationsRouter from "./notifications";
import adminRouter from "./admin";
import earningsRouter from "./earnings";
import reviewsRouter from "./reviews";
import promoRouter from "./promo";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
// Canonical (vertical-neutral) mount; "/restaurants" kept as a backward-compat alias
router.use("/stores", restaurantsRouter);
router.use("/restaurants", restaurantsRouter);
router.use("/orders", ordersRouter);
router.use("/driver/available-orders", (req, _res, next) => {
  req.url = "/available";
  next();
});
router.use("/driver", ordersRouter);
router.use("/users", usersRouter);
router.use("/notifications", notificationsRouter);
router.use("/admin", adminRouter);
router.use("/earnings", earningsRouter);
router.use("/reviews", reviewsRouter);
router.use(promoRouter);

export default router;
