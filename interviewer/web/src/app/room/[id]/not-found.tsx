import { ButtonLink, EmptyState } from "@/components/ui";

export default function RoomNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col justify-center px-4 py-12">
      <EmptyState title="This interview link does not match a record" action={<ButtonLink href="/" variant="secondary">Back to Kimma</ButtonLink>}>
        Check that you opened the whole link you were sent. If it still fails, ask the person at the company who invited you for a new one.
      </EmptyState>
    </main>
  );
}
