import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import V2Layout from '@/components/home/V2Layout';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Star, 
  TrendingUp, 
  MessageSquare, 
  ThumbsUp, 
  FileEdit, 
  Users, 
  Crown, 
  Target, 
  Brain,
  Zap,
  Gift,
  Award,
  Info,
  Rocket
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';

interface PointRule {
  action_type: string;
  category: string;
  description: string;
  points: number;
  is_active: boolean;
}

interface Level {
  id: number;
  name: string;
  required_points: number;
  icon: string | null;
  color: string | null;
  max_daily_votes: number;
  token_reward: number | null;
}

export default function PointsGuide() {
  const isMobile = useIsMobile();
  const [pointRules, setPointRules] = useState<PointRule[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rulesResponse, levelsResponse] = await Promise.all([
          supabase
            .from('point_rules')
            .select('*')
            .eq('is_active', true)
            .order('category', { ascending: true })
            .order('points', { ascending: false }),
          supabase
            .from('levels')
            .select('*')
            .order('id', { ascending: true })
        ]);

        if (rulesResponse.data) setPointRules(rulesResponse.data);
        if (levelsResponse.data) setLevels(levelsResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'content': return <FileEdit className="w-5 h-5" />;
      case 'engagement': return <MessageSquare className="w-5 h-5" />;
      case 'social': return <ThumbsUp className="w-5 h-5" />;
      case 'achievement': return <Award className="w-5 h-5" />;
      case 'contribution': return <Brain className="w-5 h-5" />;
      case 'special': return <Crown className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  const groupedRules = pointRules.reduce((acc, rule) => {
    if (!acc[rule.category]) {
      acc[rule.category] = [];
    }
    acc[rule.category].push(rule);
    return acc;
  }, {} as Record<string, PointRule[]>);

  return (
    <>
      <Helmet>
        <title>Stars & Rewards Guide - KTRENDZ</title>
        <meta name="description" content="Learn how to earn and use Stars on KTRENDZ. Complete guide to our rewards system, levels, and AI data contribution." />
      </Helmet>

      <V2Layout pcHeaderTitle="Stars & Rewards Guide" showBackButton={true}>
        <div className={`${isMobile ? 'pt-16 px-3' : ''} py-4 max-w-6xl mx-auto`}>

          {/* Stars Explanation */}
          <Card className="mb-6 md:mb-8 border-primary/20 bg-primary/5">
            <CardContent className="pt-4 md:pt-6 p-4 md:p-6">
              <div className="flex items-start gap-2 md:gap-3">
                <Info className="w-4 h-4 md:w-5 md:h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-xs md:text-sm">
                  <p className="font-semibold text-foreground mb-1">What are Stars?</p>
                  <p className="text-muted-foreground">
                    On KTRENDZ, we call our point system <strong className="text-foreground">"Stars"</strong>. 
                    Stars are the primary currency you earn through contributions and use to unlock features and rewards on the platform.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overview Cards */}
          <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
            <Card>
              <CardHeader className="p-4 md:p-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-primary/10 p-1.5 md:p-2 rounded-lg">
                    <Zap className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>
                  <CardTitle className="text-base md:text-lg">Earn Stars</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <p className="text-xs md:text-sm text-muted-foreground">
                  Create posts, write comments, vote, and contribute to wiki entries to earn Stars.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 md:p-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-primary/10 p-1.5 md:p-2 rounded-lg">
                    <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>
                  <CardTitle className="text-base md:text-lg">Level Up</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <p className="text-xs md:text-sm text-muted-foreground">
                  Accumulate total Stars to increase your level and unlock new privileges.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 md:p-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="bg-primary/10 p-1.5 md:p-2 rounded-lg">
                    <Gift className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>
                  <CardTitle className="text-base md:text-lg">Use Stars</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <p className="text-xs md:text-sm text-muted-foreground">
                  Spend Stars to create communities, boost posts, buy gift badges, and more.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* AI Data Contribution Section */}
          <Card className="mb-8 md:mb-12 border-primary/20 bg-primary/5">
            <CardHeader className="p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="bg-primary/20 p-2 md:p-3 rounded-lg">
                  <Brain className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg md:text-2xl">AI Data Contribution</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Help train AI models and earn rewards!</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6 pt-0">
              <div className="prose prose-sm max-w-none text-muted-foreground text-xs md:text-sm">
                <p>
                  KTRENDZ uses high-quality user contributions to improve AI models specialized in K-Culture. 
                  When your content is selected for AI training, you'll receive additional rewards!
                </p>
                <p className="mt-2">
                  <strong>Level-Based Token Rewards:</strong> Your level determines daily energy allocation (5-30 energy) 
                  and KTRNDZ token rewards (10-40 tokens) for completing daily activities. When DAU exceeds 100,000, 
                  Season 2 will adjust token rewards to maintain sustainable economics.
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-3 md:gap-4">
                <div className="bg-background rounded-lg p-3 md:p-4">
                  <h4 className="text-sm md:text-base font-semibold mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    What Qualifies?
                  </h4>
                  <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
                    <li>• High-quality wiki entries with verified information</li>
                    <li>• Well-researched posts with proper citations</li>
                    <li>• Detailed comments with valuable insights</li>
                    <li>• Content that receives community validation (votes, views)</li>
                  </ul>
                </div>

                <div className="bg-background rounded-lg p-3 md:p-4">
                  <h4 className="text-sm md:text-base font-semibold mb-2 flex items-center gap-2">
                    <Award className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    Extra Rewards
                  </h4>
                  <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
                    <li>• <strong>+50 Stars</strong> when your data is accepted</li>
                    <li>• <strong>+100 Stars</strong> for high-quality contributions</li>
                    <li>• <strong>+500 Stars</strong> for milestone achievements</li>
                    <li>• <strong>KTRNDZ tokens</strong>: 10-40 tokens/day based on your level (Rookie Fan → Ultimate Legend)</li>
                    <li>• <strong>Streak bonuses</strong>: +50 KTRNDZ (7-day), +200 KTRNDZ (30-day)</li>
                  </ul>
                </div>
              </div>

              <div className="bg-background rounded-lg p-3 md:p-4 flex items-start gap-2 md:gap-3">
                <Info className="w-4 h-4 md:w-5 md:h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-xs md:text-sm text-muted-foreground">
                  <strong className="text-foreground">Privacy & Transparency:</strong> Your contributions are anonymized before AI training. 
                  You can opt-out anytime, and we publish detailed reports on how data is used and rewards are calculated.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Star Rules by Category */}
          <div className="space-y-4 md:space-y-6 mb-8 md:mb-12">
            <h2 className="text-xl md:text-3xl font-bold pl-3 md:pl-4">How to Earn & Use Stars</h2>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              Object.entries(groupedRules).map(([category, rules]) => (
                <Card key={category}>
                  <CardHeader className="p-4 md:p-6">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="bg-primary/10 p-1.5 md:p-2 rounded-lg">
                        {getCategoryIcon(category)}
                      </div>
                      <CardTitle className="capitalize text-base md:text-lg">{category}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 pt-0">
                    <div className="space-y-2 md:space-y-3">
                      {rules.map((rule) => (
                        <div key={rule.action_type} className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm md:text-base font-medium">{rule.description}</p>
                            <p className="text-xs md:text-sm text-muted-foreground truncate">{rule.action_type}</p>
                          </div>
                          <Badge 
                            variant={rule.points >= 0 ? "default" : "secondary"}
                            className="ml-2 md:ml-4 text-xs md:text-sm flex-shrink-0"
                          >
                            {rule.points >= 0 ? '+' : ''}{rule.points} Stars
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Level System */}
          <Card className="mb-8 md:mb-12">
            <CardHeader className="p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="bg-primary/10 p-2 md:p-3 rounded-lg">
                  <Crown className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg md:text-2xl">Level System</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Your total Stars determine your level</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-2 md:space-y-3">
                {levels.map((level, index) => (
                  <div key={level.id}>
                    <div className="flex items-center justify-between p-3 md:p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 md:gap-4">
                        <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-background text-xl md:text-2xl flex-shrink-0">
                          {level.icon || '🌟'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm md:text-lg">{level.name}</p>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            {level.required_points.toLocaleString()} total Stars required
                          </p>
                          <p className="text-[10px] md:text-xs text-primary font-medium mt-1">
                            Daily Energy: {level.max_daily_votes} | Token Reward: {level.token_reward || 'N/A'} KTRNDZ
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs md:text-sm flex-shrink-0">Level {level.id}</Badge>
                    </div>
                    {index < levels.length - 1 && (
                      <div className="h-6 md:h-8 w-px bg-border mx-auto" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tips Section */}
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-2xl">💡 Pro Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 md:space-y-3 p-4 md:p-6 pt-0">
              <div className="p-2 md:p-3 rounded-lg bg-muted/50">
                <p className="text-sm md:text-base font-medium mb-1">Daily Login Bonus</p>
                <p className="text-xs md:text-sm text-muted-foreground">Log in every day to earn bonus Stars!</p>
              </div>
              <div className="p-2 md:p-3 rounded-lg bg-muted/50">
                <p className="text-sm md:text-base font-medium mb-1">Level-Based Daily Activities</p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Complete daily activities based on your level's energy allocation to earn KTRNDZ tokens. 
                  Higher levels earn 10-40 tokens per day!
                </p>
              </div>
              <div className="p-2 md:p-3 rounded-lg bg-muted/50">
                <p className="text-sm md:text-base font-medium mb-1">Quality Over Quantity</p>
                <p className="text-xs md:text-sm text-muted-foreground">High-quality posts that trend earn you extra Stars!</p>
              </div>
              <div className="p-2 md:p-3 rounded-lg bg-muted/50">
                <p className="text-sm md:text-base font-medium mb-1">Contribute to Wiki</p>
                <p className="text-xs md:text-sm text-muted-foreground">Creating and editing wiki entries costs Stars but builds reputation and can earn AI training rewards.</p>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <section className="py-12 md:py-16 lg:py-20 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-muted/50 via-muted/20 to-background border border-border rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-12 text-center space-y-4 md:space-y-6">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground px-2">
                Ready to Start Earning Stars?
              </h2>
              <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto px-2">
                Join the K-TRENDZ community and start earning Stars through your contributions
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 justify-center pt-2 md:pt-4">
                <a 
                  href="/"
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 md:px-6 py-2.5 md:py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors text-sm md:text-base"
                >
                  <Rocket className="w-4 h-4" />
                  Get Started
                </a>
              </div>
            </div>
          </section>
        </div>
      </V2Layout>
    </>
  );
}