export default function EveOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {children}
    </div>
  );
}
