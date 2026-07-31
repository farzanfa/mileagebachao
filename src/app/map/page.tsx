// The homepage IS the map now — keep /map as a permanent redirect so old links work.

import { permanentRedirect } from "next/navigation";

export default function MapPage(): never {
  permanentRedirect("/");
}
