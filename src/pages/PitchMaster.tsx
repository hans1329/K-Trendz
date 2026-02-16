import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronUp, ChevronDown, Shield, Heart, DollarSign, Users, Star, CheckCircle, Gift, TrendingUp, Award, Camera, X, Wand2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// 슬라이드 데이터 - 운영자 유치용 (한글)
const slides = [
  {
    id: "cover",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 md:space-y-8 px-4">
        <div className="space-y-4">
          <div className="inline-block px-4 py-2 bg-primary/20 rounded-full mb-4">
            <span className="text-primary font-semibold text-sm md:text-base">팬페이지 마스터 모집</span>
          </div>
          <h1 className="text-3xl md:text-6xl font-bold text-white drop-shadow-2xl">
            당신의 팬덤,<br />
            <span className="text-primary">당신의 이코노미</span>
          </h1>
          <p className="text-lg md:text-2xl text-white/90 font-medium drop-shadow-lg max-w-2xl mx-auto">
            K-TRENDZ와 함께 팬페이지를 지속 가능한 비즈니스로 만드세요
          </p>
        </div>
        <div className="mt-6 md:mt-8 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
          <p className="text-sm md:text-lg text-white/90">
            🎤 인증된 팬페이지 마스터를 위한 특별 혜택
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "lightstick-intro",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8">
        <div className="max-w-4xl w-full space-y-6 md:space-y-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-gradient-to-br from-primary to-orange-400 rounded-3xl flex items-center justify-center shadow-2xl mb-4">
              <Wand2 className="w-10 h-10 md:w-12 md:h-12 text-white" />
            </div>
            <h2 className="text-2xl md:text-5xl font-bold text-white">
              디지털 응원봉이란?
            </h2>
            <p className="text-lg md:text-2xl text-primary font-semibold">
              팬의 사랑을 담은 디지털 토큰
            </p>
          </div>
          
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl">
            <CardContent className="p-6 md:p-10 space-y-6">
              <p className="text-base md:text-xl text-white/90 leading-relaxed text-center">
                응원봉은 K-TRENDZ 플랫폼에서 사용되는 <span className="text-primary font-bold">팬덤 전용 디지털 토큰</span>입니다.
                팬들이 응원봉을 구매하면 아티스트와 페이지를 응원하고, 마스터님은 이를 통해 수익을 창출할 수 있습니다.
              </p>
              
              <div className="grid md:grid-cols-3 gap-4 pt-4">
                <div className="bg-white/5 rounded-xl p-5 text-center space-y-2">
                  <p className="text-3xl md:text-4xl">💝</p>
                  <h4 className="font-bold text-white">팬의 응원</h4>
                  <p className="text-sm text-white/70">좋아하는 아티스트에게 마음을 표현</p>
                </div>
                <div className="bg-white/5 rounded-xl p-5 text-center space-y-2">
                  <p className="text-3xl md:text-4xl">📈</p>
                  <h4 className="font-bold text-white">가치 상승</h4>
                  <p className="text-sm text-white/70">발행될 수록 가격이 오르는 계약</p>
                </div>
                <div className="bg-white/5 rounded-xl p-5 text-center space-y-2">
                  <p className="text-3xl md:text-4xl">🎁</p>
                  <h4 className="font-bold text-white">실질적 혜택</h4>
                  <p className="text-sm text-white/70">아티스트 서포트 & 마스터 수익</p>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-primary/20 to-orange-500/20 rounded-xl p-4 md:p-6">
                <p className="text-white/90 text-center text-sm md:text-base">
                  🌟 각 팬페이지마다 고유한 응원봉이 발행되어 <span className="text-primary font-semibold">팬덤 경제</span>를 형성합니다
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    ),
  },
  {
    id: "usp-protection",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8">
        <div className="max-w-4xl w-full space-y-6 md:space-y-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-gradient-to-br from-blue-500 to-cyan-400 rounded-3xl flex items-center justify-center shadow-2xl">
              <Shield className="w-10 h-10 md:w-12 md:h-12 text-white" />
            </div>
            <h2 className="text-2xl md:text-5xl font-bold text-white">
              사진 도용 방지
            </h2>
            <p className="text-lg md:text-2xl text-primary font-semibold">
              디지털 워터마크 기술
            </p>
          </div>
          
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl">
            <CardContent className="p-6 md:p-10 space-y-6">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Camera className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl md:text-2xl font-bold text-white">
                    고화질 사진 보호
                  </h3>
                  <p className="text-base md:text-xl text-white/80 leading-relaxed">
                    저희의 보이지 않는 디지털 워터마크 기술로 마스터님의 독점 사진을 무단 사용으로부터 보호해드립니다. 팬페이지에 업로드되는 모든 이미지가 자동으로 보호됩니다.
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 pt-4">
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold text-blue-400">🔒</p>
                  <p className="text-sm md:text-base text-white/80 mt-2">보이지 않는 보호</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold text-blue-400">🔍</p>
                  <p className="text-sm md:text-base text-white/80 mt-2">출처 추적 가능</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold text-blue-400">⚖️</p>
                  <p className="text-sm md:text-base text-white/80 mt-2">법적 증거 자료</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    ),
  },
  {
    id: "usp-support",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8">
        <div className="max-w-4xl w-full space-y-6 md:space-y-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-gradient-to-br from-pink-500 to-rose-400 rounded-3xl flex items-center justify-center shadow-2xl">
              <Heart className="w-10 h-10 md:w-12 md:h-12 text-white" />
            </div>
            <h2 className="text-2xl md:text-5xl font-bold text-white">
              직접적 아티스트 서포트
            </h2>
            <p className="text-lg md:text-2xl text-primary font-semibold">
              응원봉 수익의 10%
            </p>
          </div>
          
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl">
            <CardContent className="p-6 md:p-10 space-y-6">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Gift className="w-6 h-6 md:w-8 md:h-8 text-pink-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl md:text-2xl font-bold text-white">
                    마스터님 이름으로 서포트
                  </h3>
                  <p className="text-base md:text-xl text-white/80 leading-relaxed">
                    팬들이 구매하는 응원봉 수익의 <span className="text-primary font-bold">10%</span>가 마스터님의 이름으로 아티스트 서포트(커피차, 생일 광고 등)에 사용됩니다.
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 pt-4">
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold text-pink-400">☕</p>
                  <p className="text-sm md:text-base text-white/80 mt-2">커피차 서포트</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold text-pink-400">🎂</p>
                  <p className="text-sm md:text-base text-white/80 mt-2">생일 이벤트</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-2xl md:text-3xl font-bold text-pink-400">📺</p>
                  <p className="text-sm md:text-base text-white/80 mt-2">전광판 광고</p>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-pink-500/20 to-rose-500/20 rounded-xl p-4 md:p-6 text-center">
                <p className="text-white/90 text-base md:text-lg">
                  "<span className="text-primary font-bold">[마스터님 이름]</span>의 팬페이지가 서포트합니다"
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    ),
  },
  {
    id: "usp-earnings",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8">
        <div className="max-w-4xl w-full space-y-6 md:space-y-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-gradient-to-br from-green-500 to-emerald-400 rounded-3xl flex items-center justify-center shadow-2xl">
              <DollarSign className="w-10 h-10 md:w-12 md:h-12 text-white" />
            </div>
            <h2 className="text-2xl md:text-5xl font-bold text-white">
              창작 활동 지원
            </h2>
            <p className="text-lg md:text-2xl text-primary font-semibold">
              거래 수수료의 6%
            </p>
          </div>
          
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl">
            <CardContent className="p-6 md:p-10 space-y-6">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-green-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-green-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl md:text-2xl font-bold text-white">
                    투명한 수익 분배
                  </h3>
                  <p className="text-base md:text-xl text-white/80 leading-relaxed">
                    응원봉 거래 수수료의 <span className="text-green-400 font-bold">6%</span>가 마스터님의 창작 활동비로 투명하게 정산됩니다. 콘텐츠 제작, 장비 구매 등 자유롭게 활용하세요.
                  </p>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-4 md:p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-3xl md:text-4xl font-bold text-green-400">6%</p>
                    <p className="text-xs md:text-sm text-white/70">마스터 수익</p>
                  </div>
                  <div>
                    <p className="text-3xl md:text-4xl font-bold text-pink-400">10%</p>
                    <p className="text-xs md:text-sm text-white/70">아티스트 서포트</p>
                  </div>
                  <div>
                    <p className="text-3xl md:text-4xl font-bold text-blue-400">4%</p>
                    <p className="text-xs md:text-sm text-white/70">플랫폼</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-white/80">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm md:text-base">자동 정산 • 실시간 추적 • 완전한 투명성</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    ),
  },
  {
    id: "how-it-works",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8">
        <div className="max-w-4xl w-full space-y-6 md:space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-5xl font-bold text-white">
              참여 방법
            </h2>
            <p className="text-lg md:text-xl text-white/80">
              3단계로 팬페이지 마스터가 되세요
            </p>
          </div>
          
          <div className="space-y-4 md:space-y-6">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-xl hover:scale-[1.02] transition-transform">
              <CardContent className="p-5 md:p-8">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-primary to-orange-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl md:text-4xl font-bold text-white">1</span>
                  </div>
                  <div>
                    <h3 className="text-lg md:text-2xl font-bold text-white mb-1 md:mb-2">마스터 지원하기</h3>
                    <p className="text-sm md:text-lg text-white/70">팬페이지 포트폴리오와 SNS 활동 내역으로 지원하세요</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-xl hover:scale-[1.02] transition-transform">
              <CardContent className="p-5 md:p-8">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-pink-500 to-rose-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl md:text-4xl font-bold text-white">2</span>
                  </div>
                  <div>
                    <h3 className="text-lg md:text-2xl font-bold text-white mb-1 md:mb-2">인증 및 페이지 확보</h3>
                    <p className="text-sm md:text-lg text-white/70">팀에서 본인 확인 후 마스터 권한을 부여해드립니다</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-xl hover:scale-[1.02] transition-transform">
              <CardContent className="p-5 md:p-8">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-green-500 to-emerald-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl md:text-4xl font-bold text-white">3</span>
                  </div>
                  <div>
                    <h3 className="text-lg md:text-2xl font-bold text-white mb-1 md:mb-2">응원봉 발행 & 수익 창출</h3>
                    <p className="text-sm md:text-lg text-white/70">나만의 응원봉 토큰을 발행하고 팬 이코노미를 시작하세요</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "benefits",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8">
        <div className="max-w-4xl w-full space-y-6 md:space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-2xl md:text-5xl font-bold text-white">
              마스터 혜택
            </h2>
            <p className="text-lg md:text-xl text-white/80">
              인증된 팬페이지 마스터를 위한 특별 혜택
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-xl">
              <CardContent className="p-5 md:p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                    <Award className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-white text-base md:text-lg">인증 뱃지</h3>
                </div>
                <p className="text-sm md:text-base text-white/70">특별한 마스터 인증 뱃지로 신뢰도를 높이세요</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-xl">
              <CardContent className="p-5 md:p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
                  </div>
                  <h3 className="font-bold text-white text-base md:text-lg">수익 대시보드</h3>
                </div>
                <p className="text-sm md:text-base text-white/70">실시간 분석 및 수익 현황 추적</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-xl">
              <CardContent className="p-5 md:p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-white text-base md:text-lg">팬 관리 도구</h3>
                </div>
                <p className="text-sm md:text-base text-white/70">커뮤니티를 관리하고 소통하는 도구 제공</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-xl">
              <CardContent className="p-5 md:p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-pink-500/20 rounded-xl flex items-center justify-center">
                    <Star className="w-5 h-5 md:w-6 md:h-6 text-pink-400" />
                  </div>
                  <h3 className="font-bold text-white text-base md:text-lg">우선 지원</h3>
                </div>
                <p className="text-sm md:text-base text-white/70">마스터 전용 지원 채널 제공</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "cta",
    content: null, // CTA 슬라이드는 컴포넌트에서 별도 렌더링
  },
];

const PitchMaster = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = slides.length;
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  // 지원 모달 상태
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    artistName: "",
    email: "",
    phone: "",
    message: "",
  });

  const goToSlide = (index: number) => {
    if (index >= 0 && index < totalSlides) {
      setCurrentSlide(index);
    }
  };

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // 지원 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.artistName.trim() || !formData.email.trim()) {
      toast({
        title: "필수 항목을 입력해주세요",
        description: "아티스트명과 이메일은 필수입니다.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('master_applications')
        .insert({
          artist_name: formData.artistName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          message: formData.message.trim() || null,
        });
      
      if (error) throw error;
      
      toast({
        title: "지원이 완료되었습니다!",
        description: "검토 후 연락드리겠습니다. 감사합니다.",
      });
      
      setShowApplyDialog(false);
      setFormData({ artistName: "", email: "", phone: "", message: "" });
    } catch (error: any) {
      console.error('Application submission error:', error);
      toast({
        title: "지원 중 오류가 발생했습니다",
        description: error.message || "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // CTA 슬라이드 컨텐츠
  const CTAContent = (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
      <div className="max-w-3xl space-y-6 md:space-y-10">
        <div className="space-y-4">
          <h2 className="text-3xl md:text-6xl font-bold text-white">
            팬덤을 이끌<br />
            <span className="text-primary">준비되셨나요?</span>
          </h2>
          <p className="text-lg md:text-2xl text-white/80 max-w-2xl mx-auto">
            K-TRENDZ 팬페이지 마스터가 되어 오늘부터 팬 이코노미를 시작하세요
          </p>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/20 space-y-4">
          <div className="grid grid-cols-3 gap-4 md:gap-6 text-center">
            <div>
              <p className="text-2xl md:text-4xl font-bold text-primary">6%</p>
              <p className="text-xs md:text-sm text-white/70">수익 분배</p>
            </div>
            <div>
              <p className="text-2xl md:text-4xl font-bold text-pink-400">10%</p>
              <p className="text-xs md:text-sm text-white/70">아티스트 서포트</p>
            </div>
            <div>
              <p className="text-2xl md:text-4xl font-bold text-blue-400">100%</p>
              <p className="text-xs md:text-sm text-white/70">사진 보호</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg rounded-full"
            onClick={() => setShowApplyDialog(true)}
          >
            지금 지원하기
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white px-8 py-6 text-lg rounded-full"
            onClick={() => window.location.href = '/'}
          >
            K-Trendz 둘러보기
          </Button>
        </div>
        
        <p className="text-sm text-white/60">
          contact@k-trendz.com • k-trendz.com
        </p>
      </div>
    </div>
  );

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        nextSlide();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        prevSlide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide]);

  // 지원 모달
  const ApplyDialog = (
    <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
      <DialogContent className="sm:max-w-md max-w-[calc(100%-2rem)] mx-auto">
        <DialogHeader>
          <DialogTitle>팬페이지 마스터 지원</DialogTitle>
          <DialogDescription>
            운영하고자 하는 아티스트 정보와 연락처를 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="artistName">아티스트명 *</Label>
            <Input
              id="artistName"
              placeholder="예: BTS, aespa, 뉴진스 등"
              value={formData.artistName}
              onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">이메일 *</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">연락처 (선택)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="010-1234-5678"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">추가 메시지 (선택)</Label>
            <Textarea
              id="message"
              placeholder="기존 팬페이지 운영 경험, SNS 계정 등을 알려주세요"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={3}
            />
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowApplyDialog(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "제출 중..." : "지원하기"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  // 모바일 스크롤 뷰
  if (isMobile) {
    return (
      <>
        <Helmet>
          <title>팬페이지 마스터 모집 | K-TRENDZ</title>
          <meta name="description" content="K-TRENDZ 팬페이지 마스터가 되세요. 사진 도용 방지, 아티스트 서포트, 수익 창출까지." />
        </Helmet>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
          {slides.map((slide, index) => (
            <div 
              key={slide.id}
              className="min-h-screen flex items-center justify-center py-8"
            >
              {slide.id === "cta" ? CTAContent : slide.content}
            </div>
          ))}
        </div>
        {ApplyDialog}
      </>
    );
  }

  // 데스크탑 슬라이드 뷰
  return (
    <>
      <Helmet>
        <title>팬페이지 마스터 모집 | K-TRENDZ</title>
        <meta name="description" content="K-TRENDZ 팬페이지 마스터가 되세요. 사진 도용 방지, 아티스트 서포트, 수익 창출까지." />
      </Helmet>
      
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden">
        {/* 네비게이션 점 */}
        <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? "bg-primary scale-125" 
                  : "bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`슬라이드 ${index + 1}로 이동`}
            />
          ))}
        </div>

        {/* 네비게이션 화살표 */}
        <div className="fixed right-6 bottom-8 z-50 flex flex-col gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronUp className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            disabled={currentSlide === totalSlides - 1}
            className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronDown className="w-6 h-6" />
          </Button>
        </div>

        {/* 슬라이드 카운터 */}
        <div className="fixed left-6 bottom-8 z-50 text-white/50 text-sm">
          {currentSlide + 1} / {totalSlides}
        </div>

        {/* 슬라이드 컨테이너 */}
        <div 
          className="transition-transform duration-700 ease-out"
          style={{ transform: `translateY(-${currentSlide * 100}vh)` }}
        >
          {slides.map((slide) => (
            <div 
              key={slide.id}
              className="h-screen w-screen flex items-center justify-center p-8"
            >
              {slide.id === "cta" ? CTAContent : slide.content}
            </div>
          ))}
        </div>
      </div>
      
      {ApplyDialog}
    </>
  );
};

export default PitchMaster;
