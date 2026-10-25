import { Stamp } from "./Stamp";

/** Marks synthetic/demo data. Render wherever a record has demoData: true. */
export function DemoLabel({ className }: { className?: string }) {
  return (
    <Stamp variant="dashed" rotate={-1.5} className={className}>
      Synthetic demo data
    </Stamp>
  );
}
