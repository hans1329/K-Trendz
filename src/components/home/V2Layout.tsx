import { ReactNode, useEffect, useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import V2Sidebar from "./V2Sidebar";
import AppTabBar from "./AppTabBar";
import AppHeader from "./AppHeader";
import { useIsMobile } from "@/hooks/use-mobile";

interface V2LayoutProps {
  children: ReactNode;
  /** 모바일에서 상단 헤더 표시 여부 (기본: true) */
  showMobileHeader?: boolean;
  /** PC에서 상단 헤더 타이틀 (기본: KTRENDZ) */
  pcHeaderTitle?: string;
  /** PC에서 본문에 적용할 추가 클래스 */
  mainClassName?: string;
  /** PC에서 뒤로 가기 버튼 표시 여부 (기본: false) */
  showBackButton?: boolean;
  /** 헤더 오른쪽에 표시할 커스텀 요소 */
  headerRight?: ReactNode;
  /** PC 헤더 타이틀 영역에 표시할 커스텀 콘텐츠 (타이틀 대체) */
  headerContent?: ReactNode;
  /** PC에서 max-w-4xl 제한 없이 전체 너비 사용 (기본: false) */
  fullWidth?: boolean;
}

const V2Layout = ({ 
  children, 
  showMobileHeader = true,
  pcHeaderTitle = "KTRENDZ",
  mainClassName = "",
  showBackButton = false,
  headerRight,
  headerContent,
  fullWidth = false
}: V2LayoutProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 홈화면(/)인지 확인
  const isHomePage = location.pathname === "/";

  // PC: 전역 body padding-top(상단 Navbar 기준)이 V2Layout 헤더 위에 빈공간을 만들기 때문에 제거
  // - no-top-padding은 index.css에 정의되어 있으며 body padding-top과 #root 기본 레이아웃을 함께 해제함
  useLayoutEffect(() => {
    if (!isMobile) {
      // 다른 페이지에서 남아있을 수 있는 v2-fixed-header(!important)가 no-top-padding보다 뒤에 선언되어
      // padding-top을 다시 덮어써서(빈 공간) 보이게 할 수 있어 PC에서는 확실히 제거한다.
      document.body.classList.remove("v2-fixed-header");
      document.body.classList.add("no-top-padding");
      return () => {
        document.body.classList.remove("no-top-padding");
      };
    }
  }, [isMobile]);

  // 모바일: 바디 클래스 관리
  useEffect(() => {
    if (isMobile && showMobileHeader) {
      document.body.classList.add('v2-fixed-header');
      return () => {
        document.body.classList.remove('v2-fixed-header');
      };
    }
  }, [isMobile, showMobileHeader]);

  // 모바일: 기존 앱 레이아웃 (상단 헤더 + 하단 탭바)
  if (isMobile) {
    // 서브 페이지(뒤로가기 버튼 있음)는 커스텀 헤더 사용
    if (showBackButton) {
      return (
        <>
          <header className="fixed top-0 left-0 right-0 h-14 bg-background/80 backdrop-blur-md border-b border-border/50 z-50 flex items-center justify-between px-3 safe-area-top">
            <div className="flex items-center gap-0.5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(-1)}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/")}
                className="h-9 w-9"
              >
                <Home className="h-4 w-4" />
              </Button>
            </div>
            <h1 className="font-semibold text-base text-foreground truncate flex-1 text-center mx-2">
              {pcHeaderTitle}
            </h1>
            {headerRight || <div className="w-[4.75rem]" />}
          </header>
          <div className="pt-2 pb-20">
            {children}
          </div>
          <AppTabBar />
        </>
      );
    }
    
    return (
      <>
        {showMobileHeader && <AppHeader />}
        <div className={showMobileHeader ? "pb-20" : ""}>
          {children}
        </div>
        <AppTabBar />
      </>
    );
  }

  // PC: 사이드바 레이아웃
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden">
        <V2Sidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* PC 상단 헤더 - 사이드바 로고 영역(p-4)과 수직 정렬까지 맞춤 */}
          <header className="h-[68px] border-b border-border/50 bg-background/60 backdrop-blur-xl sticky top-0 z-40 flex items-center px-4 gap-3">
            {/* 홈화면에서는 접기 버튼 숨김 */}
            {!isHomePage && (
              showBackButton ? (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate(-1)}
                  className="h-9 w-9"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              ) : (
                <SidebarTrigger className="h-9 w-9" />
              )
            )}
            {headerContent ? (
              <div className="flex-1 overflow-hidden">{headerContent}</div>
            ) : (
              <h1 className="font-bold text-lg text-foreground flex-1">{pcHeaderTitle}</h1>
            )}
            {headerRight}
          </header>
          
          {/* 메인 콘텐츠 */}
          <main className={`flex-1 overflow-auto ${mainClassName}`}>
            {(isHomePage || fullWidth) ? (
              children
            ) : (
              <div className="max-w-4xl mx-auto px-4">
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default V2Layout;
