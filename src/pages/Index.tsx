import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import BenefitsSection from "@/components/BenefitsSection";
import QuoteSection from "@/components/QuoteSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import LeadFormSection from "@/components/LeadFormSection";
import Footer from "@/components/Footer";
import FloatingParticles from "@/components/FloatingParticles";
import AuroraBackground from "@/components/AuroraBackground";
import CustomCursor from "@/components/CustomCursor";
import PageReveal from "@/components/PageReveal";
import HardwareAccelerationPopup from "@/components/HardwareAccelerationPopup";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      <PageReveal />
      <HardwareAccelerationPopup />
      <CustomCursor />
      <AuroraBackground />
      <FloatingParticles />
      <Navbar />
      <main className="relative z-[2]">
        <HeroSection />
        <ServicesSection />
        <BenefitsSection />
        <QuoteSection />
        <TestimonialsSection />
        <LeadFormSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
