export default function GamifiedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme="gamified" style={{ height: '100%', width: '100%' }}>
      {children}
    </div>
  );
}
