import os from "os";
import multer from "multer";


const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

export const upload = multer({ storage });