// Bot Trading 페이지: Connect + Trade + Activity 3탭 구조
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import V2Layout from "@/components/home/V2Layout";
import { useIsMobile } from "@/hooks/use-mobile";
import BotTradingActivity from "@/components/home/BotTradingActivity";
import BotConnectGuide from "@/components/bot/BotConnectGuide";
import BotTradeGuide from "@/components/bot/BotTradeGuide";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Link, TrendingUp } from "lucide-react";

const VALID_TABS = ["connect", "trade", "activity"];

const BotTrading = () => {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  // URL ?tab=trade 파라미터로 기본 탭 결정
  const tabParam = searchParams.get("tab");
  const defaultTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "connect";

  return (
    <V2Layout pcHeaderTitle="Bot Trading" showBackButton={true}>
      <div className={`${isMobile ? 'px-3' : ''} py-3`}>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full mb-3 h-11">
            <TabsTrigger value="connect" className="flex-1 gap-2 text-sm h-10">
              <Link className="w-4 h-4" />
              Connect
            </TabsTrigger>
            <TabsTrigger value="trade" className="flex-1 gap-2 text-sm h-10">
              <TrendingUp className="w-4 h-4" />
              Trade
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 gap-2 text-sm h-10">
              <Activity className="w-4 h-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connect">
            <BotConnectGuide />
          </TabsContent>

          <TabsContent value="trade">
            <BotTradeGuide />
          </TabsContent>

          <TabsContent value="activity">
            <BotTradingActivity className="w-full" />
          </TabsContent>
        </Tabs>
      </div>
    </V2Layout>
  );
};

export default BotTrading;
