import cliui from "cliui";
import {
  bgBlack,
  bgBlue,
  bgCyanBright,
  bgGreen,
  bgMagenta,
  bgRed,
  bgYellow,
  black,
  green,
  red,
  white,
  yellow,
} from "colorette";
import byteSize from "byte-size";
import { Entry, Request, Response, Timings } from "har-format";
import { PrintOptions } from "./types";

type TimingKey =
  | "blocked"
  | "dns"
  | "connect"
  | "ssl"
  | "send"
  | "wait"
  | "receive";

type OutputItem = {
  abbreviation: string;
  value: string;
  percent: string;
};

type Output = {
  [key: string]: OutputItem;
};

type TimingPropsItem = {
  abbreviation: string;
  name: string;
  color: (name: string) => string;
};

const timingProps: Map<TimingKey, TimingPropsItem> = new Map([
  [
    "blocked",
    {
      name: "blocked",
      abbreviation: "b",
      color: (x: string) => bgBlack(white(x)),
    },
  ],
  [
    "dns",
    {
      name: "dns resolution",
      abbreviation: "d",
      color: (x: string) => bgMagenta(black(x)),
    },
  ],
  [
    "connect",
    {
      name: "connecting",
      abbreviation: "c",
      color: (x: string) => bgRed(white(x)),
    },
  ],
  [
    "ssl",
    {
      name: "tls setup",
      abbreviation: "t",
      color: (x: string) => bgCyanBright(black(x)),
    },
  ],
  [
    "send",
    {
      name: "sending",
      abbreviation: "s",
      color: (x: string) => bgYellow(black(x)),
    },
  ],
  [
    "wait",
    {
      name: "waiting",
      abbreviation: "w",
      color: (x: string) => bgGreen(black(x)),
    },
  ],
  [
    "receive",
    {
      name: "receiving",
      abbreviation: "r",
      color: (x: string) => bgBlue(black(x)),
    },
  ],
]);

const maxLength = 80;

export function print(
  index: number,
  { request, response, time, timings }: Entry,
  { style: display }: PrintOptions,
  printFn: (output: string) => void = (output) => console.log(output)
) {
  const isCompact = display === "compact";
  const ui = cliui();

  const status = response.status.toString()[0];
  const statusColor =
    status === "2" ? green : ["4", "5"].includes(status) ? red : yellow;

  ui.div({
    text: `${isCompact ? "" : `${index + 1}. `}${statusColor(
      response.status
    )} ${request.method} ${request.url}${
      isCompact ? ` (${time.toFixed(2)}ms)` : ""
    }`,
    padding: [0, 0, isCompact ? 0 : 1, 0],
    border: !isCompact,
  });

  printTimings(timings, time, isCompact, ui);

  if (!isCompact) {
    ui.div({ text: "" });
    printRequest(request, ui);

    ui.div({ text: "" });
    printResponse(response, ui);
    ui.div({ text: "" });
  }

  printFn(ui.toString());
}

function printTimings(timings: Timings, time: number, isCompact: boolean, ui) {
  const total = Object.values(timings).reduce((acc, cur) =>
    cur < 0 ? acc : cur + acc
  );
  const progress = [];
  const output: Output = {};

  const sortedTimings = [
    ["blocked", timings.blocked || -1],
    ["dns", timings.dns || -1],
    ["connect", timings.connect || -1],
    ["ssl", timings.ssl || -1],
    ["send", timings.send || -1],
    ["wait", timings.wait],
    ["receive", timings.receive],
  ].filter(([_k, v]) => v > 0) as [TimingKey, number][];

  let maxMeasurementLength = 1;
  for (const [key, value] of sortedTimings) {
    const percent = Number((value / total) * 100).toFixed(2);
    const fixedValue = value.toFixed(2);
    const digitLength = String(fixedValue).length;
    if (digitLength > maxMeasurementLength) {
      maxMeasurementLength = digitLength;
    }
    const props = timingProps.get(key);
    output[props.name] = {
      abbreviation: props.abbreviation,
      value: fixedValue,
      percent,
    };

    progress.push([
      props.color,
      props.abbreviation,
      (Number(percent) / 100) * (maxLength - sortedTimings.length),
    ]);
  }

  let bar = "";
  for (const [color, character, width] of progress) {
    let segment = "";
    let cur = Math.round(width);
    const midpoint = Math.ceil(width / 2);

    while (cur > 0) {
      segment += cur === midpoint ? character : "-";
      cur = cur - 1;
    }

    if (segment.length) {
      segment = segment.substring(0, segment.length);
    }

    segment += "|";

    bar += color(segment);
  }

  ui.div({
    text: bar,
    padding: [0, 0, 1, 0],
  });

  if (isCompact) {
    return;
  }

  const summary = Object.entries(output).map(
    ([key, { abbreviation, value, percent }]) => {
      return [
        { text: `${key} (${abbreviation})`, width: 19, align: "right" },
        {
          text: `: ${String(value).padStart(
            maxMeasurementLength
          )}ms (${percent}%)`,
          width: 20,
        },
      ];
    }
  );

  ui.div(
    {
      text: `total time`,
      width: 19,
      align: "right",
    },
    {
      text: `: ${time.toFixed(2).padStart(maxMeasurementLength)}ms`,
      width: 20,
    }
  );

  for (const item of summary) {
    ui.div(...item);
  }
}

function printRequest(request: Request, ui) {
  ui.div("request:");

  const headersSize = byteSize(request.headersSize || 0).toString();
  const bodySize = byteSize(request.bodySize || 0).toString();
  const totalSize = byteSize(
    (request.headersSize || 0) + (request.bodySize || 0)
  ).toString();
  const maxRequestSizeDigits = Math.max(
    headersSize.length,
    bodySize.length,
    totalSize.length
  );

  ui.div({
    text: "size:",
    padding: [0, 0, 0, 2],
  });

  ui.div(
    {
      text: "headers",
      width: 11,
      align: "right",
    },
    {
      text: `: ${headersSize.padStart(maxRequestSizeDigits)}`,
    }
  );

  ui.div(
    {
      text: "body",
      width: 11,
      align: "right",
    },
    {
      text: `: ${bodySize.padStart(maxRequestSizeDigits)}`,
    }
  );

  ui.div(
    {
      text: "total",
      width: 11,
      align: "right",
    },
    {
      text: `: ${totalSize.padStart(maxRequestSizeDigits)}`,
    }
  );
}

function printResponse(response: Response, ui) {
  ui.div("response:");

  if (response.content?.compression) {
    const original = response.content.size;
    const diff = original - response.bodySize;
    const contentEncodingHeader = response.headers.find((header) => {
      return header.name.toLowerCase() === "content-encoding";
    }) || { value: "<<unknown>>" };
    ui.div({
      text: `compression: ${contentEncodingHeader.value}, saved ${byteSize(
        diff
      )} (${Number((diff / original) * 100).toFixed(2)}%)`,
      padding: [0, 0, 0, 2],
    });
  } else {
    ui.div({
      text: `compression: none`,
      padding: [0, 0, 0, 2],
    });
  }

  const headersSize = byteSize(response.headersSize || 0).toString();
  const bodySize = byteSize(response.bodySize || 0).toString();
  const totalSize = byteSize(
    (response.headersSize || 0) + (response.bodySize || 0)
  ).toString();
  const maxRequestSizeDigits = Math.max(
    headersSize.length,
    bodySize.length,
    totalSize.length
  );

  ui.div({
    text: "size:",
    padding: [0, 0, 0, 2],
  });

  ui.div(
    {
      text: "headers",
      width: 11,
      align: "right",
    },
    {
      text: `: ${headersSize.padStart(maxRequestSizeDigits)}`,
    }
  );

  ui.div(
    {
      text: "body",
      width: 11,
      align: "right",
    },
    {
      text: `: ${bodySize.padStart(maxRequestSizeDigits)}`,
    }
  );

  ui.div(
    {
      text: "total",
      width: 11,
      align: "right",
    },
    {
      text: `: ${totalSize.padStart(maxRequestSizeDigits)}`,
    }
  );
}
