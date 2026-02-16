import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";

const Privacy = () => {
  return (
    <>
      <Helmet>
        <title>Privacy Policy - KTRENDZ</title>
        <meta name="description" content="Learn how KTRENDZ collects, uses, and protects your personal information. Your privacy is our priority." />
        <link rel="canonical" href="https://k-trendz.com/privacy" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Navbar />
        
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8 text-foreground">Privacy Policy</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">1. Information We Collect</h2>
              <p>We collect information you provide directly to us when you:</p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Create an account</li>
                <li>Post content or comments</li>
                <li>Participate in community discussions</li>
                <li>Contact us for support</li>
              </ul>
              <p className="mt-2">This may include your username, email address, profile information, and content you create.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">2. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Provide, maintain, and improve our services</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze trends and usage</li>
                <li>Detect, prevent, and address technical issues</li>
                <li>Protect against spam and abuse</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">3. Information Sharing</h2>
              <p>We do not sell your personal information. We may share your information only in the following circumstances:</p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>With your consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and prevent fraud</li>
                <li>With service providers who assist in operating our platform</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">4. Data Security</h2>
              <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">5. Cookies and Tracking</h2>
              <p>We use cookies and similar tracking technologies to collect information about your browsing activities and to provide a personalized experience. You can control cookies through your browser settings.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">6. Third-Party Services</h2>
              <p>We use third-party services for authentication (Google OAuth) and backend services (Supabase). These services have their own privacy policies governing the use of your information.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Request deletion of your information</li>
                <li>Object to our use of your information</li>
                <li>Export your data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">8. Children's Privacy</h2>
              <p>Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">9. Changes to Privacy Policy</h2>
              <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">10. Contact Us</h2>
              <p>If you have any questions about this Privacy Policy, please contact us through our platform.</p>
            </section>

            <p className="text-sm mt-8 pt-8 border-t border-border">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </main>
      </div>
    </>
  );
};

export default Privacy;