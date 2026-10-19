const allowedOrigins: string[] = ["https://www.example.com"];

const corsOptions = {
  origin: function (origin: string | undefined, callback: any) {
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      origin.startsWith("http://10.10.20.") ||
      origin.startsWith("http://3.76.70")
    ) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

export = corsOptions;
