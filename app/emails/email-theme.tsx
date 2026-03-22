import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type EmailLayoutProps = {
  preview: string;
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
  details?: React.ReactNode;
  note?: React.ReactNode;
  footerNote?: React.ReactNode;
};

export function EmailLayout({
  preview,
  eyebrow,
  title,
  description,
  actionLabel,
  actionHref,
  details,
  note,
  footerNote,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.hero}>
            <Text style={styles.brand}>Nexus Orchestrator</Text>
            <Text style={styles.tagline}>
              Enterprise workflow access, secured with confidence.
            </Text>
          </Section>

          <Section style={styles.panel}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Heading style={styles.title}>{title}</Heading>
            <Text style={styles.description}>{description}</Text>

            {actionLabel && actionHref ? (
              <Button href={actionHref} style={styles.button}>
                {actionLabel}
              </Button>
            ) : null}

            {details ? <Section style={styles.detailsBlock}>{details}</Section> : null}
            {note ? <Text style={styles.note}>{note}</Text> : null}
          </Section>

          <Section style={styles.footerPanel}>
            <div style={styles.footerRow}>
              <div style={styles.footerBrandWrap}>
                <div style={styles.footerBadge}>NO</div>
                <div>
                  <Text style={styles.footerHeading}>Nexus Auth Gateway</Text>
                  <Text style={styles.footerCopy}>
                    {footerNote ??
                      `© ${new Date().getFullYear()} Nexus Orchestrator. All rights reserved.`}
                  </Text>
                </div>
              </div>
              <div style={styles.footerPills}>
                <span style={styles.pill}>Privacy</span>
                <span style={styles.pill}>Security</span>
                <span style={styles.pill}>Compliance</span>
              </div>
            </div>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Emphasis({ children }: { children: React.ReactNode }) {
  return <span style={styles.emphasis}>{children}</span>;
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <Section style={styles.codePanel}>
      <Text style={styles.codeText}>{code}</Text>
    </Section>
  );
}

export const styles = {
  main: {
    margin: "0",
    backgroundColor: "#f8f9ff",
    backgroundImage:
      "radial-gradient(circle at top center, rgba(0,120,199,0.12), transparent 35%)",
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
    color: "#0b1c30",
  },
  container: {
    margin: "0 auto",
    padding: "28px 0 40px",
    width: "100%",
    maxWidth: "620px",
  },
  hero: {
    padding: "24px 20px 20px",
    textAlign: "center" as const,
  },
  brand: {
    margin: "0",
    color: "#005f9e",
    fontSize: "26px",
    fontWeight: "700",
    letterSpacing: "-0.02em",
  },
  tagline: {
    margin: "8px 0 0",
    color: "#5f6b7c",
    fontSize: "14px",
    lineHeight: "22px",
    fontWeight: "500",
  },
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    padding: "40px",
    boxShadow: "0 12px 32px rgba(11, 28, 48, 0.06)",
  },
  eyebrow: {
    margin: "0 0 10px",
    color: "#5f6b7c",
    fontSize: "11px",
    lineHeight: "16px",
    fontWeight: "700",
    textTransform: "uppercase" as const,
    letterSpacing: "0.16em",
  },
  title: {
    margin: "0 0 16px",
    color: "#0b1c30",
    fontSize: "28px",
    lineHeight: "34px",
    fontWeight: "700",
    letterSpacing: "-0.03em",
  },
  description: {
    margin: "0 0 28px",
    color: "#314154",
    fontSize: "16px",
    lineHeight: "26px",
  },
  emphasis: {
    color: "#0b1c30",
    fontWeight: "700",
  },
  button: {
    background: "linear-gradient(135deg, #005f9e 0%, #0078c7 100%)",
    borderRadius: "14px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: "15px",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "block",
    padding: "16px 24px",
    boxShadow: "0 12px 28px rgba(0,95,158,0.18)",
  },
  detailsBlock: {
    margin: "24px 0 0",
  },
  codePanel: {
    margin: "0 0 20px",
    padding: "16px 18px",
    borderRadius: "18px",
    backgroundColor: "#eff4ff",
  },
  codeText: {
    margin: "0",
    color: "#0b1c30",
    fontSize: "32px",
    lineHeight: "40px",
    fontWeight: "800",
    letterSpacing: "0.32em",
    textAlign: "center" as const,
  },
  note: {
    margin: "20px 0 0",
    color: "#5f6b7c",
    fontSize: "14px",
    lineHeight: "22px",
  },
  footerPanel: {
    marginTop: "18px",
    borderRadius: "22px",
    backgroundColor: "rgba(255,255,255,0.78)",
    padding: "20px 22px",
    boxShadow: "0 12px 30px rgba(11, 28, 48, 0.04)",
  },
  footerRow: {
    width: "100%",
  },
  footerBrandWrap: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  footerBadge: {
    width: "36px",
    height: "36px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #005f9e 0%, #0078c7 100%)",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: "800",
    lineHeight: "36px",
    textAlign: "center" as const,
    letterSpacing: "0.14em",
  },
  footerHeading: {
    margin: "0",
    color: "#5f6b7c",
    fontSize: "11px",
    lineHeight: "16px",
    fontWeight: "700",
    textTransform: "uppercase" as const,
    letterSpacing: "0.16em",
  },
  footerCopy: {
    margin: "4px 0 0",
    color: "#6c7888",
    fontSize: "12px",
    lineHeight: "18px",
  },
  footerPills: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap" as const,
  },
  pill: {
    borderRadius: "999px",
    border: "1px solid rgba(192,199,211,0.18)",
    backgroundColor: "rgba(255,255,255,0.78)",
    padding: "7px 12px",
    color: "#5f6b7c",
    fontSize: "10px",
    lineHeight: "10px",
    fontWeight: "700",
    textTransform: "uppercase" as const,
    letterSpacing: "0.14em",
  },
} as const;
