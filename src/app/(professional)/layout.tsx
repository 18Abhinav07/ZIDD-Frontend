export default function ProfessionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme="professional" style={{ height: '100%', width: '100%' }}>
      {children}
    </div>
  );
}
