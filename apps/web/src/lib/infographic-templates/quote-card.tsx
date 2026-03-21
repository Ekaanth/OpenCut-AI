import type { FC } from "react";

export interface QuoteCardProps {
  quote: string;
  attribution: string;
  attributionTitle?: string;
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export const QuoteCard: FC<QuoteCardProps> = ({
  quote,
  attribution,
  attributionTitle = "",
  primaryColor = "#f59e0b",
  backgroundColor = "#1c1917",
  textColor = "#fafaf9",
  accentColor = "#78716c",
  fontFamily = "Georgia, 'Times New Roman', serif",
}) => {
  return (
    <div
      style={{
        position: "relative",
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        overflow: "hidden",
      }}
    >
      {/* Decorative corner accents */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 60,
          width: 80,
          height: 80,
          borderTop: `3px solid ${accentColor}44`,
          borderLeft: `3px solid ${accentColor}44`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: 60,
          width: 80,
          height: 80,
          borderBottom: `3px solid ${accentColor}44`,
          borderRight: `3px solid ${accentColor}44`,
        }}
      />

      <div
        style={{
          maxWidth: 1400,
          textAlign: "center",
          padding: "0 100px",
        }}
      >
        {/* Opening quotation mark */}
        <div
          style={{
            fontSize: 200,
            fontWeight: 700,
            color: primaryColor,
            lineHeight: 0.6,
            marginBottom: 20,
            opacity: 0.8,
            fontFamily: "Georgia, serif",
          }}
        >
          {"\u201C"}
        </div>

        {/* Quote text */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 400,
            color: textColor,
            lineHeight: 1.5,
            fontStyle: "italic",
            marginBottom: 48,
          }}
        >
          {quote}
        </div>

        {/* Closing quotation mark */}
        <div
          style={{
            fontSize: 200,
            fontWeight: 700,
            color: primaryColor,
            lineHeight: 0.3,
            marginBottom: 48,
            opacity: 0.8,
            fontFamily: "Georgia, serif",
          }}
        >
          {"\u201D"}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 80,
            height: 3,
            backgroundColor: primaryColor,
            margin: "0 auto 32px",
            borderRadius: 2,
          }}
        />

        {/* Attribution */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: textColor,
            letterSpacing: "0.05em",
            fontStyle: "normal",
            fontFamily: "Inter, Helvetica, Arial, sans-serif",
          }}
        >
          {attribution}
        </div>

        {attributionTitle && (
          <div
            style={{
              fontSize: 22,
              fontWeight: 400,
              color: accentColor,
              marginTop: 8,
              fontStyle: "normal",
              fontFamily: "Inter, Helvetica, Arial, sans-serif",
            }}
          >
            {attributionTitle}
          </div>
        )}
      </div>
    </div>
  );
};

export const templateConfig = {
  id: "quote-card",
  name: "Quote Card",
  category: "text",
  defaultProps: {
    quote:
      "The only way to do great work is to love what you do.",
    attribution: "Steve Jobs",
    attributionTitle: "Co-founder, Apple Inc.",
    primaryColor: "#f59e0b",
    backgroundColor: "#1c1917",
    textColor: "#fafaf9",
    accentColor: "#78716c",
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
};
