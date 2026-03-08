/**
 * Bracket Layout — full-width container for the bracket page.
 *
 * Removes any default page padding/margins so the bracket can use
 * the full viewport width for optimal horizontal space.
 */

export default function BracketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", width: "100%" }}>{children}</div>
  );
}
