const sections = ["Staff", "Schedules", "Payroll", "Compliance"] as const;

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center gap-2">
          <h1 className="text-xl font-bold text-primary">DentOps</h1>
          <span className="text-sm text-muted-foreground">Admin Portal</span>
        </div>
      </header>
      <main className="container py-8">
        <h2 className="mb-6 text-2xl font-semibold">Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {sections.map((section) => (
            <div key={section} className="rounded-lg border bg-card p-6 shadow-sm">
              <h3 className="font-semibold">{section}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Manage {section.toLowerCase()}</p>
            </div>
          ))}
          <a
            href="/time-clock"
            className="rounded-lg border bg-card p-6 shadow-sm hover:border-[#1D9E75] hover:shadow-md transition-all"
          >
            <h3 className="font-semibold text-[#1D9E75]">Time Clock</h3>
            <p className="mt-1 text-sm text-muted-foreground">Live clock-in board &amp; today's log</p>
          </a>
          <a
            href="/pto"
            className="rounded-lg border bg-card p-6 shadow-sm hover:border-[#1D9E75] hover:shadow-md transition-all"
          >
            <h3 className="font-semibold text-[#1D9E75]">PTO Manager</h3>
            <p className="mt-1 text-sm text-muted-foreground">Requests, team calendar &amp; blackout dates</p>
          </a>
        </div>
      </main>
    </div>
  );
}
