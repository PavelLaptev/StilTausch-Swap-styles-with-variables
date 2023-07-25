// Check that the input is a valid number
// function setSuggestionsForNumberInput(
//   query: string,
//   result: SuggestionResults,
//   completions?: string[]
// ) {
//   if (query === "") {
//     result.setSuggestions(completions ?? []);
//   } else if (!Number.isFinite(Number(query))) {
//     result.setError("Please enter a numeric value");
//   } else if (Number(query) <= 0) {
//     result.setError("Must be larger than 0");
//   } else {
//     const filteredCompletions = completions
//       ? completions.filter((s) => s.includes(query) && s !== query)
//       : [];
//     result.setSuggestions([query, ...filteredCompletions]);
//   }
// }

const init = async () => {
  figma.skipInvisibleInstanceChildren = true;
  let variablesSuggestions: string[] = [];
  const variableCollections =
    await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  let collection: LibraryVariableCollection | undefined;

  // console.log(findAllColorStylesInDocument());

  // The 'input' event listens for text change in the Quick Actions box after a plugin is 'Tabbed' into.
  figma.parameters.on(
    "input",
    async ({ query, key, result }: ParameterInputEvent) => {
      if (query.length === 0) {
        result.setError("The name should be full including slashes");
        return;
      }

      if (key === "style-name") {
        result.setSuggestions([query]);
      }

      if (key === "collection-name") {
        collection = variableCollections.find((collection) => {
          return collection.name === query;
        });

        if (collection === undefined) {
          result.setError("No matching collection found");
          return;
        }

        result.setSuggestions([query]);

        await figma.teamLibrary
          .getVariablesInLibraryCollectionAsync(collection.key)
          .then((variables) => {
            variablesSuggestions = variables.map((variable) => variable.name);
          });
      }

      if (key === "variable-name") {
        // result.setSuggestions([query]);
        // const filteredSuggestions = variablesSuggestions.filter((s) =>
        //   s.includes(query)
        // );
        // result.setSuggestions(filteredSuggestions);
        // variableCollections[

        const filteredSuggestions = variablesSuggestions.filter((s) =>
          s.includes(query)
        );

        result.setSuggestions(filteredSuggestions);
      }
    }
  );

  // When the user presses Enter after inputting all parameters, the 'run' event is fired.
  figma.on("run", async ({ command, parameters }: RunEvent) => {
    if (command == "swapp-all") {
      swapAll(parameters as ParameterValues);
    } else {
      await swapManual(parameters as ParameterValues);
    }
    figma.closePlugin();
  });

  const swapAll = (parameters: ParameterValues) => {
    console.log(parameters);
  };

  const swapManual = async (parameters: ParameterValues) => {
    const allNodes = figma.root.findAll();

    // COLOR STYLES
    const allMatchedColorStyles = allNodes.filter((node: any) => {
      if (typeof node.fillStyleId !== "string") {
        return false;
      }

      if (node.type === "INSTANCE") {
        return false;
      }

      const styleId = node.fillStyleId;
      const styleName = figma.getStyleById(styleId)?.name;

      // console.log(styleName);

      if (styleName === undefined) {
        return false;
      }

      return styleName === parameters["style-name"];
    });

    console.log("allMatchedColorStyles", allMatchedColorStyles);

    if (allMatchedColorStyles.length === 0) {
      figma.notify("No matching styles in the file", {
        timeout: 3000,
        error: true
      });
      return;
    }

    // COLLECTIONS
    const collection = variableCollections.find((collection) => {
      return collection.name === parameters["collection-name"];
    });

    if (collection === undefined) {
      figma.notify("No matching collection found", {
        timeout: 3000,
        error: true
      });
      return;
    }

    // VARIABLES
    const variables =
      await figma.teamLibrary.getVariablesInLibraryCollectionAsync(
        collection.key
      );

    const teamVariable = variables.find((variable) => {
      return variable.name === parameters["variable-name"];
    });

    if (teamVariable === undefined) {
      figma.notify("No matching variable found", {
        timeout: 3000,
        error: true
      });
      return;
    }

    const importedVariable = await figma.variables.importVariableByKeyAsync(
      teamVariable.key
    );

    allMatchedColorStyles.forEach((node: any) => {
      const fillsCopy = JSON.parse(JSON.stringify(node.fills));

      fillsCopy[0] = figma.variables.setBoundVariableForPaint(
        fillsCopy[0],
        "color",
        importedVariable
      );

      node.fills = fillsCopy;
    });

    figma.notify(`Swapped ${allMatchedColorStyles.length} styles! 🎉`, {
      timeout: 3000
    });

    // console.log(variable);

    // console.log(allMatchedColorStyles);

    // const collections =
    //   figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    // // const collectionName = parameters["collection-name"];

    // console.log(collections);

    // console.log(allMatchedColorStyles);

    // allNodes.forEach((node) => {
    //   if (node.fillStyleId === styleName) {
    //     node.fillStyleId = variableName;
    //   }
    // });
  };
};

init();

// function resizeRelative(parameters: ParameterValues) {
//   const scale = parseFloat(parameters.scale);

//   for (const node of figma.currentPage.selection) {
//     if ("rescale" in node) {
//       node.rescale(scale);
//     }
//   }
// }

// function resizeAbsolute(parameters: ParameterValues) {
//   const width = parseInt(parameters.width);
//   const height = parseInt(parameters.height);

//   for (const node of figma.currentPage.selection) {
//     if ("resize" in node) {
//       node.resize(width, height);
//     }
//   }
// }
