"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";

export type WeeklySessionRow = {
  week: string;
  completed: number;
  confirmed: number;
  cancelled: number;
  no_show: number;
  value_delivered: number;
};

export type MonthlyRow = {
  month: string;
  revenue: number;
  sessions_sold: number;
};

export type PackageStat = {
  name: string;
  count: number;
  revenue: number;
};

export type NameValue = { name: string; value: number };
export type RevenueByDemo = { name: string; revenue: number; clients: number };

interface Props {
  weeklySessionData: WeeklySessionRow[];
  monthlyData: MonthlyRow[];
  packageStats: PackageStat[];
  sessionStatusBreakdown: NameValue[];
  genderData: NameValue[];
  ageData: NameValue[];
  experienceData: NameValue[];
  revenueByGender: RevenueByDemo[];
  revenueByAge: RevenueByDemo[];
}

const C = {
  blue: "#3B82F6",
  green: "#10B981",
  red: "#EF4444",
  amber: "#F59E0B",
  purple: "#8B5CF6",
  teal: "#14B8A6",
  pink: "#EC4899",
  indigo: "#6366F1",
};
const PIE = [C.blue, C.green, C.amber, C.purple, C.pink, C.teal];

const aud = (v: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 }).format(v);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
    {children}
  </div>
);

const Empty = () => (
  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">No data yet</p>
);

export default function Charts({
  weeklySessionData,
  monthlyData,
  packageStats,
  sessionStatusBreakdown,
  genderData,
  ageData,
  experienceData,
  revenueByGender,
  revenueByAge,
}: Props) {
  return (
    <div className="space-y-5">

      {/* ── Row 1: Sessions per week + Status donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Sessions per Week — Last 8 Weeks">
          <div className="lg:col-span-2">
            {weeklySessionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={weeklySessionData} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="completed" name="Completed" stackId="a" fill={C.green} />
                  <Bar dataKey="confirmed" name="Confirmed" stackId="a" fill={C.blue} />
                  <Bar dataKey="no_show" name="No Show" stackId="a" fill={C.amber} />
                  <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill={C.red} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>
        </Card>

        {/* span the Sessions per Week card across 2 cols */}
        <div className="space-y-5">
          <Card title="Session Breakdown (8 Wks)">
            {sessionStatusBreakdown.some(s => s.value > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={sessionStatusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={60}>
                      {sessionStatusBreakdown.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {sessionStatusBreakdown.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: PIE[i % PIE.length] }} />
                        <span className="text-gray-600 dark:text-gray-400 capitalize">{s.name.replace("_", " ")}</span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <Empty />}
          </Card>

          <Card title="Value Delivered ($/wk)">
            {weeklySessionData.some(w => w.value_delivered > 0) ? (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={weeklySessionData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <XAxis dataKey="week" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v: any) => [aud(v ?? 0), "Value"]} />
                  <Bar dataKey="value_delivered" name="Value" fill={C.teal} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">Link bookings to packages to see value</p>
            )}
          </Card>
        </div>
      </div>

      {/* ── Row 2: Revenue & Sessions Sold + Package Popularity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Revenue & Sessions Sold — Last 6 Months">
          {monthlyData.some(m => m.revenue > 0 || m.sessions_sold > 0) ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="rev" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <YAxis yAxisId="qty" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val: any, name: any) =>
                    name === "Revenue" ? [aud(val ?? 0), name] : [val ?? 0, name]
                  }
                />
                <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill={C.blue} radius={[3, 3, 0, 0]} />
                <Bar yAxisId="qty" dataKey="sessions_sold" name="Sessions Sold" fill={C.teal} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Card>

        <Card title="Most Popular Packages">
          {packageStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={packageStats.slice(0, 7)}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip
                  formatter={(val: any, name: any) =>
                    name === "Revenue ($)" ? [aud(val ?? 0), name] : [val ?? 0, name]
                  }
                />
                <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" name="Purchases" fill={C.purple} radius={[0, 3, 3, 0]} />
                <Bar dataKey="revenue" name="Revenue ($)" fill={C.green} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Card>
      </div>

      {/* ── Row 3: Demographics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Client Gender">
          {genderData.some(g => g.value > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={58}>
                    {genderData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                {genderData.map((g, i) => (
                  <div key={g.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE[i % PIE.length] }} />
                    <span className="text-gray-600 dark:text-gray-400 capitalize truncate">{g.name}</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100 ml-auto">{g.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <Empty />}
        </Card>

        <Card title="Age Distribution">
          {ageData.some(a => a.value > 0) ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={ageData} margin={{ top: 0, right: 0, left: -26, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Clients" fill={C.blue} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Card>

        <Card title="Experience Level">
          {experienceData.some(e => e.value > 0) ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={experienceData} margin={{ top: 0, right: 0, left: -26, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Clients" fill={C.purple} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Card>
      </div>

      {/* ── Row 4: Revenue by Demographics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Revenue by Gender">
          {revenueByGender.some(r => r.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={revenueByGender} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: any) => [aud(v ?? 0), "Revenue"]} />
                <Bar dataKey="revenue" name="Revenue" fill={C.green} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Card>

        <Card title="Revenue by Age Group">
          {revenueByAge.some(r => r.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={revenueByAge} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: any) => [aud(v ?? 0), "Revenue"]} />
                <Bar dataKey="revenue" name="Revenue" fill={C.amber} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Card>
      </div>

    </div>
  );
}
