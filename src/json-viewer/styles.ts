import jss from "jss";
import preset from "jss-preset-default";

const commonJsonFont = {
  "font-family": `"JetBrains Mono", ui-monospace, "Cascadia Code",
    "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace`,
};

export type ThemeKey =
  | "jsonKey"
  | "jsonString"
  | "jsonNumber"
  | "jsonBoolean"
  | "jsonTitle"
  | "jsonNull";

export type Theme = Record<ThemeKey, Record<string, string>> & {
  bgColor?: string;
};

jss.setup(preset());

export function makeStyleSheet(theme: Theme) {
  const styles = {
    jsonContainer: {
      "background-color": theme.bgColor ?? "",
    },
    jsonArray__content: { "margin-left": "0.5 em" },
    jsonArray__empty: { color: "grey" },
    jsonObject__trivia: { color: "grey" },

    jsonObject__header: {
      display: "flex",
      gap: "0.5em",
    },

    jsonObject__header__name: {
      ...theme.jsonTitle,
      "font-size": "1em",
      "font-weight": 600,
      "&:hover": {
        cursor: "pointer",
        "text-decoration": "underline",
      },
    },

    jsonObject__header__toggle: {
      ...theme.jsonKey,
      display: "flex",
      "font-weight": 600,
      "align-items": "center",
    },

    jsonObject__content: { "margin-left": "1.75em" },
    jsonObject__content__item: { gap: "0.5em" },
    jsonObject__content__item__online: { display: "flex", gap: "0.5em" },
    jsonObject__content__item__key: {
      ...theme.jsonKey,
      "user-select": "none",
      "&:after": {
        content: '":"',
        color: "grey",
        "margin-right": "0.5em",
      },
    },

    jsonObject__keyButton: {
      "&:hover": {
        cursor: "pointer",
        "text-decoration": "underline",
      },
    },
    jsonString: {
      ...theme.jsonString,
      "&::before": {
        content: '"\\""',
      },
      "&::after": {
        content: '"\\""',
      },
      ...commonJsonFont,
    },
    jsonBool: { ...theme.jsonBoolean, ...commonJsonFont },
    jsonNull: { ...theme.jsonNull, ...commonJsonFont },
    jsonNumber: { ...theme.jsonNumber, ...commonJsonFont },
    jsonObject: commonJsonFont,
  };

  return jss.createStyleSheet(styles);
}

// Tokyo night
export const defaultTheme: Theme = {
  bgColor: "#1a1b26",
  jsonTitle: { color: "#bb9af7" },
  jsonKey: { color: "#7aa2f7" },
  jsonString: { color: "#9ece6a" },
  jsonBoolean: { color: "#c0caf5" },
  jsonNumber: { color: "#ff9e64" },
  jsonNull: { color: "#bb9af7" },
};

export const defaultStyleSheet = makeStyleSheet(defaultTheme);
export type StyleSheet = ReturnType<typeof makeStyleSheet>;
