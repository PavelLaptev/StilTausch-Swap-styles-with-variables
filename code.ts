const init = async () => {
  figma.skipInvisibleInstanceChildren = true;

  let variablesSuggestions: string[] = [];
  let collection: LibraryVariableCollection | undefined;

  const variableCollections =
    await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

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
        const filteredSuggestions = variablesSuggestions.filter((s) =>
          s.includes(query)
        );

        result.setSuggestions(filteredSuggestions);
      }
    }
  );

  // When the user presses Enter after inputting all parameters, the 'run' event is fired.
  figma.on("run", async ({ command, parameters }: RunEvent) => {
    if (command === "swap-all") {
      swapAll(parameters as ParameterValues);
    }
    if (command === "swap-manual-by-page") {
      await swapManual(parameters as ParameterValues, true);
    }
    if (command === "swap-manual-by-file") {
      await swapManual(parameters as ParameterValues, false);
    }
  });

  //////////////
  // SWAP ALL //
  //////////////
  const swapAll = (parameters: ParameterValues) => {
    console.log(parameters);
  };

  /////////////////
  // MANUAL SWAP //
  /////////////////
  const swapManual = async (parameters: ParameterValues, byPage: boolean) => {
    const allCurrentPageNodes = figma.currentPage.findAll();

    console.log("allCurrentPageNodes", allCurrentPageNodes);

    const allAllowedNodes = allCurrentPageNodes.filter((node: any) => {
      if (
        !node.fillStyleId ||
        typeof node.fillStyleId !== "string" ||
        node.type === "INSTANCE"
      ) {
        return false;
      }

      return true;
    });

    // COLOR STYLES
    const allMatchedColorStyles = allAllowedNodes.filter((node: any) => {
      const styleId = node.fillStyleId;
      const styleName = figma.getStyleById(styleId)?.name;

      return styleName === parameters["style-name"];
    });

    // console.log("allMatchedColorStyles", allMatchedColorStyles);

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

    let swappedStylesCount = 0;

    allMatchedColorStyles.forEach(async (node: any) => {
      const fillsCopy = JSON.parse(JSON.stringify(node.fills));

      // console.log("fillsCopy", fillsCopy);

      fillsCopy[0] = figma.variables.setBoundVariableForPaint(
        fillsCopy[0],
        "color",
        importedVariable
      );

      // console.log("fillsCopy", fillsCopy);
      console.log("node", node.fills);

      node.fills = await fillsCopy;

      swappedStylesCount++;
    });

    // SUCCESS
    const successMessage = `Swapped ${swappedStylesCount} from ${allMatchedColorStyles.length} styles! 🎉`;
    figma.notify(successMessage, {
      timeout: 3000
    });
    console.log(successMessage);
    figma.closePlugin();
  };
};

init();
