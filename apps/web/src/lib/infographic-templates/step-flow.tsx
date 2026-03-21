import type { FC } from "react";

export interface Step {
  title: string;
  description: string;
}

export interface StepFlowProps {
  steps: Step[];
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
}

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export const StepFlow: FC<StepFlowProps> = ({
  steps,
  primaryColor = "#7c3aed",
  accentColor = "#a78bfa",
  backgroundColor = "#0c0a1d",
  fontFamily = "Inter, Helvetica, Arial, sans-serif",
}) => {
  const displaySteps = steps.slice(0, 5);

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
        padding: "0 80px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 0,
          width: "100%",
          justifyContent: "center",
        }}
      >
        {displaySteps.map((step, index) => (
          <div
            key={`step-${step.title}`}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            {/* Step card */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 280,
              }}
            >
              {/* Step number circle */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  backgroundColor: primaryColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 24,
                  boxShadow: `0 0 30px ${primaryColor}66`,
                }}
              >
                <span
                  style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: "#ffffff",
                  }}
                >
                  {index + 1}
                </span>
              </div>

              {/* Title */}
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#ffffff",
                  textAlign: "center",
                  marginBottom: 12,
                  lineHeight: 1.3,
                }}
              >
                {step.title}
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 400,
                  color: "#94a3b8",
                  textAlign: "center",
                  lineHeight: 1.5,
                  maxWidth: 240,
                }}
              >
                {step.description}
              </div>
            </div>

            {/* Arrow connector */}
            {index < displaySteps.length - 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 80,
                  marginTop: -60,
                }}
              >
                <svg
                  width="60"
                  height="24"
                  viewBox="0 0 60 24"
                  fill="none"
                  style={{ display: "block" }}
                >
                  <path
                    d="M0 12H52M52 12L42 4M52 12L42 20"
                    stroke={accentColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const templateConfig = {
  id: "step-flow",
  name: "Step Flow",
  category: "process",
  defaultProps: {
    steps: [
      { title: "Research", description: "Gather data and insights" },
      { title: "Design", description: "Create wireframes and mockups" },
      { title: "Develop", description: "Build and implement features" },
    ],
    primaryColor: "#7c3aed",
    accentColor: "#a78bfa",
    backgroundColor: "#0c0a1d",
    fontFamily: "Inter, Helvetica, Arial, sans-serif",
  },
};
