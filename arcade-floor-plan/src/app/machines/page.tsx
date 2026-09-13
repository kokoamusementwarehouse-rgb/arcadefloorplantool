import { AuthBoundary } from "../../components/auth/AuthBoundary";
import { MachineRegistry } from "../../components/machines/MachineRegistry";

export default function MachinesPage() {
  return <AuthBoundary><MachineRegistry /></AuthBoundary>;
}
