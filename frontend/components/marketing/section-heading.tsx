export function SectionHeading({
  title,
  description,
  light,
}: {
  title: string;
  description?: string;
  light?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2
        className={`font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl ${
          light ? "text-[var(--mkt-bg)]" : "text-[var(--mkt-fg)]"
        }`}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={`mt-3 text-base text-pretty md:text-lg ${
            light ? "text-[var(--mkt-bg)]/70" : "text-[var(--mkt-muted)]"
          }`}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
