import { FloorPlanEditor } from "../../components/floor-plan/FloorPlanEditor";
import { AuthBoundary } from "../../components/auth/AuthBoundary";
/** Route-shaped entry point retained for the planned Next.js migration. */
export default function FloorPlanPage() { return <AuthBoundary><FloorPlanEditor /></AuthBoundary>; }
