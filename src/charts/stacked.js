console.log("stacked loaded");

const svg = d3.select("#stacked");

svg.append("rect")
  .attr("x", 50)
  .attr("y", 50)
  .attr("width", 200)
  .attr("height", 100)
  .attr("fill", "orange");
