import { groundSortDepth, OBJECT_DEPTH_BAND } from "../packages/client/src/world/depthSort.ts";
console.log("ground", groundSortDepth(-2983.5, 678.5));
console.log("band", OBJECT_DEPTH_BAND);
console.log("sum*1024", (-2983.5 + 678.5) * 1024);
