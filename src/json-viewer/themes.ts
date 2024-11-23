import { Theme } from "./styles";

const tokyoNight = {
  bgColor: "#1a1b26",
  jsonTitle: { color: "#bb9af7" },
  jsonKey: { color: "#7aa2f7" },
  jsonString: { color: "#9ece6a" },
  jsonBoolean: { color: "#c0caf5" },
  jsonNumber: { color: "#ff9e64" },
  jsonNull: { color: "#bb9af7" },
};

const espresso: Theme = {
  bgColor: "#ffffff",
  jsonNumber: {
    color: "#CF4F5F",
    "font-weight": "bold",
  },

  jsonKey: { color: "#2F6F9F" },
  jsonBoolean: { color: "#CF4F5F" },
  jsonString: { color: "#CF4F5F" },
  jsonNull: { color: "#CF4F5F" },
  jsonTitle: { color: "#CF4F5F" },
};

const barf: Theme = {
  bgColor: "#15191EFA",
  jsonNumber: { color: "#C1E1B8" },
  jsonKey: { color: "#697A8E" },
  jsonBoolean: { color: "#53667D" },
  jsonString: { color: "#5C81B3" },
  jsonNull: { color: "#697A8E" },
  jsonTitle: { color: "#708E67" },
};

const solarizedLight: Theme = {
  bgColor: "#fef7e5",
  jsonNumber: { color: "#D33682" },
  jsonKey: { color: "#93A1A1" },
  jsonBoolean: { color: "#B58900" },
  jsonString: { color: "#2AA198" },
  jsonNull: { color: "#B58900" },
  jsonTitle: { color: "#859900" },
};

const rosePineDawn: Theme = {
  bgColor: "#faf4ed",
  jsonNumber: { color: "#d7827e" },
  jsonKey: { color: "#907aa9" },
  jsonBoolean: { color: "#286983" },
  jsonString: { color: "#ea9d34" },
  jsonNull: { color: "#FFCC66" },
  jsonTitle: { color: "#286983" },
};

export default { espresso, barf, solarizedLight, rosePineDawn, tokyoNight };
