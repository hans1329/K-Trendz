import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import WalletInitializer from "@/components/WalletInitializer";
import LoginPromptBanner from "@/components/LoginPromptBanner";
import { InvitationCodeGuard } from "@/components/InvitationCodeGuard";
import { useReferralCode } from "@/hooks/useReferralCode";
import Index from "./pages/Index";
import Posts from "./pages/Posts";
import CreatePost from "./pages/CreatePost";
import PostDetail from "./pages/PostDetail";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import Communities from "./pages/Communities";
import Community from "./pages/Community";
import CreateCommunity from "./pages/CreateCommunity";
import Earn from "./pages/Earn";
import Purchase from "./pages/Purchase";
import Mentions from "./pages/Mentions";
import Messages from "./pages/Messages";
import Conversation from "./pages/Conversation";
import Notifications from "./pages/Notifications";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Whitepaper from "./pages/Whitepaper";
import Sitemap from "./pages/Sitemap";
import PendingPosts from "./pages/PendingPosts";
import Calendar from "./pages/Calendar";
import CreateCalendarEvent from "./pages/CreateCalendarEvent";
import Wiki from "./pages/Wiki";
import CreateWiki from "./pages/CreateWiki";
import EditWiki from "./pages/EditWiki";
import WikiHistory from "./pages/WikiHistory";
import WikiDetail from "./pages/WikiDetail";
import Rankings from "./pages/Rankings";
import EventDetail from "./pages/EventDetail";
import Wallet from "./pages/Wallet";
import PointsGuide from "./pages/PointsGuide";
import MyFanzTokens from "./pages/MyFanzTokens";
import MyWatchlist from "./pages/MyWatchlist";
import About from "./pages/About";
import PitchDeck from "./pages/PitchDeck";
import PitchDeckMain from "./pages/PitchDeckMain";
import PitchDeckKr from "./pages/PitchDeckKr";
import PitchDeck3 from "./pages/PitchDeck3";
import PitchDeck2En from "./pages/PitchDeck2En";
import PitchDeck3En from "./pages/PitchDeck3En";
import PitchDeckAlliance from "./pages/PitchDeckAlliance";
import PitchDeckAllianceKr from "./pages/PitchDeckAllianceKr";
import PitchDeckVariant from "./pages/PitchDeckVariant";
import PitchDeckVariantKr from "./pages/PitchDeckVariantKr";
import PitchMaster from "./pages/PitchMaster";
import OwnerDashboard from "./pages/OwnerDashboard";
import Team from "./pages/Team";
import SpecialEvent from "./pages/SpecialEvent";
import Challenges from "./pages/Challenges";
import ProposalChat from "./pages/ProposalChat";
import WikiChatRoom from "./pages/WikiChatRoom";
import AdminChallengeReview from "./pages/AdminChallengeReview";
import AdminWithdrawals from "./pages/AdminWithdrawals";
import AdminTokenTrades from "./pages/AdminTokenTrades";
import LolCoach from "./pages/LolCoach";
import FarcasterApp from "./pages/FarcasterApp";
import IndexV2 from "./pages/IndexV2";
import ArtistRankings from "./pages/ArtistRankings";
import TrendingRankings from "./pages/TrendingRankings";
import Discover from "./pages/Discover";
import Trade from "./pages/Trade";
import Support from "./pages/Support";
import BotTrading from "./pages/BotTrading";
import AgentChat from "./pages/AgentChat";
import MyAgent from "./pages/MyAgent";
import MiniAppHub from "./pages/MiniAppHub";
import MiniAppHome from "./pages/MiniAppHome";
import MiniAppShop from "./pages/MiniAppShop";
import FarcasterMiniAppReady from "@/components/FarcasterMiniAppReady";

const queryClient = new QueryClient();

// Farcaster miniapps 디렉토리(farcaster.xyz)에서 프록시로 열릴 때
// pathname이 "/miniapps/<appId>/<slug>/..." 형태가 된다.
// 이 경우 BrowserRouter basename을 잡아줘야 라우팅이 404로 빠지지 않는다.
const getRouterBasename = () => {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname;
  const match = path.match(/^\/miniapps\/[^/]+\/[^/]+/);
  return match ? match[0] : "";
};

// URL의 ref 파라미터를 처리하는 컴포넌트
const ReferralCodeHandler = () => {
  useReferralCode();
  return null;
};

const App = () => {
  const basename = getRouterBasename();

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename={basename || undefined}>
            <ScrollToTop />
            <ReferralCodeHandler />
            <FarcasterMiniAppReady />
            
            {/* Farcaster 미니앱 라우트 - InvitationCodeGuard 바깥에 위치 */}
            <Routes>
              <Route path="/miniapp" element={<MiniAppHub />} />
              <Route path="/miniapp/challenges" element={<MiniAppHome />} />
              <Route path="/miniapp/shop" element={<MiniAppShop />} />
              <Route path="/farcaster-app/:challengeId" element={<FarcasterApp />} />
              <Route path="*" element={
                <>
                  <WalletInitializer />
                  <LoginPromptBanner />
                  <InvitationCodeGuard>
                    <Routes>
                      <Route path="/" element={<IndexV2 />} />
                      <Route path="/posts" element={<Posts />} />
                      <Route path="/news" element={<Index />} />
                      <Route path="/create" element={<CreatePost />} />
                      <Route path="/edit/:id" element={<CreatePost />} />
                      <Route path="/post/:id" element={<PostDetail />} />
                      <Route path="/p/:slug" element={<PostDetail />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/u/:username" element={<UserProfile />} />
                      <Route path="/earn" element={<Earn />} />
                      <Route path="/purchase" element={<Purchase />} />
                      <Route path="/mentions" element={<Mentions />} />
                      <Route path="/messages" element={<Messages />} />
                      <Route path="/messages/:conversationId" element={<Conversation />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
                      <Route path="/admin/token-trades" element={<AdminTokenTrades />} />
                      <Route path="/admin/challenge/:id" element={<AdminChallengeReview />} />
                      <Route path="/pending" element={<PendingPosts />} />
                      <Route path="/communities" element={<Communities />} />
                      <Route path="/c/:slug" element={<Community />} />
                      <Route path="/create-community" element={<CreateCommunity />} />
                      <Route path="/calendar" element={<Calendar />} />
                      <Route path="/calendar/create" element={<CreateCalendarEvent />} />
                      <Route path="/event/:id" element={<EventDetail />} />
                      <Route path="/wiki" element={<Wiki />} />
                      <Route path="/wiki/create" element={<CreateWiki />} />
                      <Route path="/fanz/:id" element={<WikiDetail />} />
                      <Route path="/k/:id" element={<WikiDetail />} />
                      <Route path="/k/:id/edit" element={<EditWiki />} />
                      <Route path="/k/:id/history" element={<WikiHistory />} />
                      <Route path="/k/:id/chat/:chatroomId" element={<WikiChatRoom />} />
                      <Route path="/rankings" element={<Rankings />} />
                      <Route path="/special-event" element={<SpecialEvent />} />
                      <Route path="/challenges" element={<Challenges />} />
                      <Route path="/challenges/:challengeId" element={<Challenges />} />
                      <Route path="/proposal/:proposalId/chat" element={<ProposalChat />} />
                      <Route path="/wallet" element={<Wallet />} />
                      <Route path="/points-guide" element={<PointsGuide />} />
                      <Route path="/my-fanz" element={<MyFanzTokens />} />
                      <Route path="/my-watchlist" element={<MyWatchlist />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/whitepaper" element={<Whitepaper />} />
                      <Route path="/sitemap.xml" element={<Sitemap />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/pitch-deck" element={<PitchDeck />} />
                      <Route path="/pitchdeck" element={<PitchDeckMain />} />
                      <Route path="/pitch-deck-kr" element={<PitchDeckKr />} />
                      <Route path="/pitch-deck3" element={<PitchDeck3 />} />
                      <Route path="/pitch-deck2-en" element={<PitchDeck2En />} />
                      <Route path="/pitch-deck3-en" element={<PitchDeck3En />} />
                      <Route path="/pitch-deck-alliance" element={<PitchDeckAlliance />} />
                      <Route path="/pitch-deck-alliance-kr" element={<PitchDeckAllianceKr />} />
                      <Route path="/pitch-deck-variant" element={<PitchDeckVariant />} />
                      <Route path="/pitch-deck-variant-kr" element={<PitchDeckVariantKr />} />
                      <Route path="/pitch-master" element={<PitchMaster />} />
                      <Route path="/owner-dashboard" element={<OwnerDashboard />} />
                      <Route path="/team" element={<Team />} />
                      <Route path="/opp" element={<LolCoach />} />
                      {/* /v2 removed - IndexV2 is now the main page */}
                      <Route path="/artists" element={<ArtistRankings />} />
                      <Route path="/trending" element={<TrendingRankings />} />
                      <Route path="/discover" element={<Discover />} />
                      <Route path="/trade" element={<Trade />} />
                      <Route path="/bot-trading" element={<BotTrading />} />
                      <Route path="/agent-chat" element={<AgentChat />} />
                      <Route path="/my-agent" element={<MyAgent />} />
                      <Route path="/support" element={<Support />} />
                      
                      {/* Category route - must be AFTER all specific routes */}
                      <Route path="/:category" element={<Rankings />} />
                      
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </InvitationCodeGuard>
                </>
              } />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
