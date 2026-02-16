import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import logo from "@/assets/logo.png";
import { Coins, Users, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { KeyManagementDiagram } from "@/components/KeyManagementDiagram";

const tokenDistributionData = [{
  name: 'Community Mining',
  value: 70,
  amount: '3,500,000,000',
  color: 'hsl(var(--primary))'
}, {
  name: 'Team & Advisors',
  value: 10,
  amount: '500,000,000',
  color: 'hsl(var(--chart-1))'
}, {
  name: 'Early Investors',
  value: 8,
  amount: '400,000,000',
  color: 'hsl(var(--chart-2))'
}, {
  name: 'Liquidity',
  value: 7,
  amount: '350,000,000',
  color: 'hsl(var(--chart-3))'
}, {
  name: 'Treasury Reserve',
  value: 5,
  amount: '250,000,000',
  color: 'hsl(var(--chart-4))'
}];

const communityMiningData = [{
  name: 'Content Creation',
  value: 45,
  description: 'Wiki, Posts, Comments'
}, {
  name: 'Quality Rewards',
  value: 20,
  description: 'Upvotes, Trending, Featured'
}, {
  name: 'Engagement',
  value: 10,
  description: 'Daily Login, Streak Bonuses'
}, {
  name: 'Governance',
  value: 5,
  description: 'DAO Participation, Voting'
}];

const tokenSpecsData = [{
  spec: 'Name',
  value: 'K-Trendz Token'
}, {
  spec: 'Symbol',
  value: 'KTNZ'
}, {
  spec: 'Standard',
  value: 'ERC20'
}, {
  spec: 'Network',
  value: 'Base (Coinbase L2)'
}, {
  spec: 'Contract Address',
  value: '0x45dB0DA161Ede30990f827b09881938CDFfE1df6'
}, {
  spec: 'Total Supply',
  value: '5,000,000,000 KTNZ'
}, {
  spec: 'Initial Issuance',
  value: '1,500,000,000 KTNZ (30%)'
}, {
  spec: 'Minting Supply',
  value: '3,500,000,000 KTNZ (70%)'
}];

const dailyEnergyLevelsData = [{
  level: '🌱 Rookie Fan',
  dailyEnergy: 5,
  activityReward: 10,
  color: 'hsl(var(--chart-1))'
}, {
  level: '⭐ Rising Star',
  dailyEnergy: 13,
  activityReward: 15,
  color: 'hsl(var(--chart-2))'
}, {
  level: '💎 Dedicated Stan',
  dailyEnergy: 18,
  activityReward: 20,
  color: 'hsl(var(--chart-3))'
}, {
  level: '👑 Super Fan',
  dailyEnergy: 22,
  activityReward: 30,
  color: 'hsl(var(--chart-4))'
}, {
  level: '🏆 Ultimate Legend',
  dailyEnergy: 30,
  activityReward: 40,
  color: 'hsl(var(--primary))'
}];

const Whitepaper = () => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/WHITEPAPER.md")
      .then((response) => response.text())
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading whitepaper:", error);
        setLoading(false);
      });
  }, []);

  const markdownComponents = {
    h1: ({ children }: any) => {
      const text = children?.toString() || '';
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return (
        <div className="mt-8 mb-8" id={id}>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {children}
          </h1>
          <div className="h-1 w-20 bg-gradient-to-r from-primary to-primary/40 rounded-full" />
        </div>
      );
    },
    h2: ({ children }: any) => {
      const text = children?.toString() || '';
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const isTokenEconomics = text.includes('Token Economics');
      const isDailyEnergySystem = text.includes('Daily Energy System');

      if (isTokenEconomics) {
        return (
          <>
            <div className="mt-8 mb-6" id={id}>
              <h2 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">
                {children}
              </h2>
              <div className="h-0.5 w-16 bg-primary/60 rounded-full" />
            </div>

            <div className="my-8 space-y-8">
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Coins className="w-6 h-6 text-primary" />
                    KTNZ Token Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 font-semibold text-foreground">Parameter</th>
                          <th className="text-left py-3 px-4 font-semibold text-foreground">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokenSpecsData.map((item, idx) => (
                          <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 font-medium text-foreground/80">{item.spec}</td>
                            <td className="py-3 px-4 text-foreground font-mono">{item.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-primary" />
                    Token Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={tokenDistributionData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {tokenDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                            formatter={(value: number, name: string) => [`${value}%`, name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-4">
                      {tokenDistributionData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="font-medium text-foreground">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-foreground">{item.value}%</div>
                            <div className="text-sm text-foreground/60 font-mono">{item.amount}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" />
                    Community Mining Breakdown (70% of Total Supply)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={communityMiningData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                        <YAxis stroke="hsl(var(--foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {communityMiningData.map((item, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-muted/30">
                        <div className="font-semibold text-foreground mb-1">{item.name} ({item.value}%)</div>
                        <div className="text-sm text-foreground/70">{item.description}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        );
      }

      if (isDailyEnergySystem) {
        return (
          <>
            <div className="mt-8 mb-6" id={id}>
              <h2 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">
                {children}
              </h2>
              <div className="h-0.5 w-16 bg-primary/60 rounded-full" />
            </div>

            <div className="my-8">
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-primary" />
                    User Level Energy & Token Rewards
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Bar Chart */}
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyEnergyLevelsData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="level" 
                            stroke="hsl(var(--foreground))"
                            tick={{ fontSize: 12 }}
                            interval={0}
                            angle={-15}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis stroke="hsl(var(--foreground))" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Bar dataKey="dailyEnergy" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} name="Daily Energy" />
                          <Bar dataKey="activityReward" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Activity Reward (KTNZ)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-2 font-semibold text-foreground text-sm">Level</th>
                            <th className="text-center py-3 px-2 font-semibold text-foreground text-sm">Daily Energy</th>
                            <th className="text-center py-3 px-2 font-semibold text-foreground text-sm">Activity Reward</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyEnergyLevelsData.map((item, idx) => (
                            <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="py-3 px-2 font-medium text-foreground/90 text-sm">{item.level}</td>
                              <td className="py-3 px-2 text-center text-foreground font-mono text-sm">{item.dailyEnergy}</td>
                              <td className="py-3 px-2 text-center text-foreground font-mono text-sm">{item.activityReward} KTNZ</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        );
      }

      return (
        <div className="mt-8 mb-6" id={id}>
          <h2 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">
            {children}
          </h2>
          <div className="h-0.5 w-16 bg-primary/60 rounded-full" />
        </div>
      );
    },
    h3: ({ children }: any) => {
      const text = children?.toString() || '';
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const isFanzTokenSystem = text.includes('Fanz Token System') || text.includes('Lightstick Support');

      if (isFanzTokenSystem) {
        return (
          <>
            <h3 className="text-xl md:text-2xl font-semibold mb-4 mt-8 text-foreground" id={id}>
              {children}
            </h3>
            <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎤</span>
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">
                      Fan Page Economy Model
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      The Fanz Token System applies the concept of <strong>Lightsticks (응원봉)</strong> to Fan Pages. 
                      When fans purchase lightstick tokens, the Fan Page's score and ranking increase, 
                      and as more tokens are purchased, the value of tokens held by existing supporters appreciates. 
                      This creates a sustainable economy where fans directly contribute to and benefit from a Fan Page's success.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        );
      }

      return (
        <h3 className="text-xl md:text-2xl font-semibold mb-6 mt-8 text-foreground" id={id}>
          {children}
        </h3>
      );
    },
    p: ({ children }: any) => (
      <p className="mb-4 leading-relaxed text-foreground/90">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="list-none mb-6 space-y-3 text-foreground/90">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside mb-6 space-y-3 text-foreground/90 marker:text-primary marker:font-semibold">
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="flex items-start gap-3">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mt-2.5 flex-shrink-0" />
        <span className="flex-1">{children}</span>
      </li>
    ),
    code: ({ className, children }: any) => {
      const isBlock = className?.includes("language-");
      const isMermaid = className?.includes("language-mermaid");

      if (isMermaid) {
        return <KeyManagementDiagram />;
      }

      return isBlock ? (
        <pre className="bg-muted/50 p-6 rounded-xl overflow-x-auto mb-6 border border-border">
          <code className="text-sm text-foreground font-mono">{children}</code>
        </pre>
      ) : (
        <code className="bg-primary/10 px-2 py-1 rounded text-sm text-primary font-mono">
          {children}
        </code>
      );
    },
    a: ({ href, children }: any) => {
      const isExternal = href?.startsWith('http');
      const isAnchor = href?.startsWith('#');

      if (isAnchor) {
        return (
          <a
            href={href}
            className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors font-medium"
            onClick={(e) => {
              e.preventDefault();
              const id = href.slice(1);
              const element = document.getElementById(id);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          >
            {children}
          </a>
        );
      }

      return (
        <a
          href={href}
          className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors font-medium"
          target={isExternal ? '_blank' : '_self'}
          rel={isExternal ? 'noopener noreferrer' : undefined}
        >
          {children}
        </a>
      );
    },
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-primary pl-6 py-2 italic my-6 text-foreground/80 bg-primary/5 rounded-r-lg">
        {children}
      </blockquote>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-8 rounded-xl border border-border shadow-sm">
        <table className="min-w-full divide-y divide-border">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => <thead className="bg-muted/50">{children}</thead>,
    th: ({ children }: any) => (
      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground uppercase tracking-wider">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="px-6 py-4 text-sm text-foreground/90 border-t border-border">
        {children}
      </td>
    ),
    tr: ({ children }: any) => (
      <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
    ),
    strong: ({ children }: any) => (
      <strong className="font-bold text-foreground">{children}</strong>
    ),
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>K-TRENDZ Whitepaper | Global K-Culture Fan Platform</title>
        <meta name="description" content="K-TRENDZ Whitepaper - Empowering global K-culture fans through blockchain rewards and community contribution on Base Network." />
      </Helmet>

      <Navbar />

      <main className="flex-1">
        <section className="py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 flex justify-center">
              <img src={logo} alt="K-TRENDZ Logo" className="w-auto rounded-2xl" style={{ height: '67.2px' }} />
            </div>
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-8">
                      <Skeleton className="h-8 w-3/4 mb-4" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <article className="prose prose-slate dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>
              </article>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Whitepaper;
