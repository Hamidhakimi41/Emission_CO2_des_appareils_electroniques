const svg = d3.select("#scatter");
const width = +svg.attr("width");
const height = +svg.attr("height");

const margin = { top: 40, right: 40, bottom: 60, left: 60 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const g = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

d3.csv("data/scatter_data.csv").then(data => {

    data.forEach(d => {
        d.gwp_total = +d.gwp_total;
        d.weight = +d.weight;
    });

    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.weight))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.gwp_total))
        .range([innerHeight, 0]);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    g.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    g.append("g").call(yAxis);

    g.append("g")
        .selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.weight))
        .attr("cy", d => yScale(d.gwp_total))
        .attr("r", 5)
        .attr("fill", "steelblue");
});
