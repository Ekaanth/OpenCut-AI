export { LowerThird, templateConfig as lowerThirdConfig } from "./lower-third";
export type { LowerThirdProps } from "./lower-third";

export {
  StatCallout,
  templateConfig as statCalloutConfig,
} from "./stat-callout";
export type { StatCalloutProps } from "./stat-callout";

export {
  Comparison,
  templateConfig as comparisonConfig,
} from "./comparison";
export type { ComparisonProps, ComparisonItem } from "./comparison";

export { StepFlow, templateConfig as stepFlowConfig } from "./step-flow";
export type { StepFlowProps, Step } from "./step-flow";

export { QuoteCard, templateConfig as quoteCardConfig } from "./quote-card";
export type { QuoteCardProps } from "./quote-card";

export {
  ListOverlay,
  templateConfig as listOverlayConfig,
} from "./list-overlay";
export type { ListOverlayProps } from "./list-overlay";

export {
  ProgressBar,
  templateConfig as progressBarConfig,
} from "./progress-bar";
export type { ProgressBarProps } from "./progress-bar";

import { templateConfig as _lowerThird } from "./lower-third";
import { templateConfig as _statCallout } from "./stat-callout";
import { templateConfig as _comparison } from "./comparison";
import { templateConfig as _stepFlow } from "./step-flow";
import { templateConfig as _quoteCard } from "./quote-card";
import { templateConfig as _listOverlay } from "./list-overlay";
import { templateConfig as _progressBar } from "./progress-bar";

export const allTemplateConfigs = [
  _lowerThird,
  _statCallout,
  _comparison,
  _stepFlow,
  _quoteCard,
  _listOverlay,
  _progressBar,
];
