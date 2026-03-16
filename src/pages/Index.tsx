import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";

import ServicesSection from "@/components/ServicesSection";
import BenefitsSection from "@/components/BenefitsSection";
import QuoteSection from "@/components/QuoteSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import LeadFormSection from "@/components/LeadFormSection";
import Footer from "@/components/Footer";
import FloatingParticles from "@/components/FloatingParticles";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      <FloatingParticles />
      <Navbar />
      <main>
        <HeroSection />
        
        <ServicesSection />
        <BenefitsSection />
        <QuoteSection />
        <TestimonialsSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
