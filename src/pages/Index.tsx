import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TechWallSection from "@/components/TechWallSection";
import ServicesSection from "@/components/ServicesSection";
import BenefitsSection from "@/components/BenefitsSection";
import QuoteSection from "@/components/QuoteSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import LeadFormSection from "@/components/LeadFormSection";
import Footer from "@/components/Footer";
import FloatingParticles from "@/components/FloatingParticles";

const Index = () => {
  return (
    <div className="min-h-screen bg-white relative">
      {/* Subtle ambient glows on white */}
      <div className="fixed z-0 pointer-events-none inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-primary/[0.04] blur-[140px] rounded-full" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-400/[0.03] blur-[120px] rounded-full" />
      </div>

      <FloatingParticles />
      <Navbar />
      <main>
        <HeroSection />
        <TechWallSection />
        
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
