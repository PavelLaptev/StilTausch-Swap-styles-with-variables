// --------------------------------------
// UTILS SECTION
// --------------------------------------

const filterAllowedNodes = (nodes: any[]) => {
  const filtered = nodes.filter((node: any) => {
    if (
      !node.fillStyleId ||
      typeof node.fillStyleId !== "string" ||
      node.type === "INSTANCE"
    ) {
      return false;
    }

    return true;
  });

  return filtered;
};

const successMessage = (successMessage: string) => {
  figma.notify(successMessage, {
    timeout: 3000
  });
  console.log(successMessage);
  figma.closePlugin();
};

const errorMessage = (errorMessage: string) => {
  figma.notify(errorMessage, {
    timeout: 3000,
    error: true
  });
  console.log(errorMessage);
  figma.closePlugin();
};

// --------------------------------------
// UNIT SELECTION
// --------------------------------------
// in order to run async function we wrap
// all in a function
// --------------------------------------

const init = async () => {
  console.clear();

  figma.skipInvisibleInstanceChildren = true;
  let swappedStylesCount = 0;

  let variablesSuggestions: string[] = [];

  const variableCollections =
    await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

  // The 'input' event listens for text change in the Quick Actions box after a plugin is 'Tabbed' into.
  figma.parameters.on(
    "input",
    async ({ query, key, result, parameters }: ParameterInputEvent) => {
      if (query.length === 0) {
        result.setError("The name should be full including slashes");
        return;
      }

      // STYLE NAME
      if (key === "style-name") {
        result.setSuggestions([query]);
      }

      // COLLECTION NAME
      if (key === "collection-name") {
        const filteredSuggestions = variableCollections
          .map((collection) => collection.name)
          .filter((s) => s.includes(query));

        result.setSuggestions(filteredSuggestions);
      }

      // VARIABLE NAME
      if (key === "variable-name") {
        const collection = variableCollections.find((collection) => {
          return collection.name === parameters["collection-name"];
        });

        // chedk if collection exists
        if (collection === undefined) {
          result.setError("No matching collection found");
          return;
        }

        await figma.teamLibrary
          .getVariablesInLibraryCollectionAsync(collection.key)
          .then((variables) => {
            variablesSuggestions = variables.map((variable) => variable.name);
          });

        const filteredSuggestions = variablesSuggestions.filter((s) =>
          s.includes(query)
        );

        result.setSuggestions(filteredSuggestions);
      }
    }
  );

  // When the user presses Enter after inputting all parameters, the 'run' event is fired.
  figma.on("run", async ({ command, parameters }: RunEvent) => {
    figma.notify("Swapping styles...", {
      timeout: 1000
    });

    if (command === "swap-all-in-page") {
      await swapAll(parameters as ParameterValues, true);
    }
    if (command === "swap-all-in-file") {
      await swapAll(parameters as ParameterValues, false);
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
  const swapAll = async (
    parameters: ParameterValues,
    byPage: boolean = false
  ) => {
    // get all node
    const allNodes = byPage
      ? figma.currentPage.findAll()
      : figma.root.findAll();

    const allAllowedNodes = filterAllowedNodes(allNodes);

    const collection = variableCollections.find((collection) => {
      return collection.name === parameters["collection-name"];
    });

    if (collection === undefined) {
      errorMessage("No matching collection found");
      return;
    }

    // VARIABLES
    const variables =
      await figma.teamLibrary.getVariablesInLibraryCollectionAsync(
        collection.key
      );

    console.log("variables amount", variables.length);
    console.log("allAllowedNodes amount", allAllowedNodes.length);

    // replace styles with matching variable
    for (const node of allAllowedNodes) {
      const styleId = node.fillStyleId;

      if (typeof styleId !== "string") {
        // Instead of a return statement, continue to the next iteration
        continue;
      }

      // console.log("--------------------");
      // console.log("node", node);
      // console.log("styleId", styleId);

      const style = figma.getStyleById(styleId);
      const styleName = style?.name;

      // console.log("style", style);
      // console.log("styleName", styleName);

      if (styleName === undefined) {
        // Instead of a return statement, continue to the next iteration
        continue;
      }

      const teamVariable = variables.find((variable) => {
        return variable.name === styleName;
      });

      if (teamVariable === undefined) {
        // Instead of a return statement, continue to the next iteration
        continue;
      }

      const importedVariable = await figma.variables.importVariableByKeyAsync(
        teamVariable.key
      );

      const fillsCopy = JSON.parse(JSON.stringify(node.fills));

      fillsCopy[0] = figma.variables.setBoundVariableForPaint(
        fillsCopy[0],
        "color",
        importedVariable
      );

      swappedStylesCount++;

      node.fills = await fillsCopy;
    }

    // SUCCESS
    successMessage(`Swapped ${swappedStylesCount} styles! 🎉`);
  };

  /////////////////
  // MANUAL SWAP //
  /////////////////
  const swapManual = async (parameters: ParameterValues, byPage: boolean) => {
    console.log("parameters", parameters);

    const allNodes = byPage
      ? figma.currentPage.findAll()
      : figma.root.findAll();

    const allAllowedNodes = filterAllowedNodes(allNodes);

    // COLOR STYLES
    const allMatchedColorStyles = allAllowedNodes.filter((node: any) => {
      const styleId = node.fillStyleId;

      if (typeof styleId !== "string") {
        return false;
      }

      const styleName = figma.getStyleById(styleId)?.name;

      return styleName === parameters["style-name"];
    });

    // console.log("allMatchedColorStyles", allMatchedColorStyles);

    if (allMatchedColorStyles.length === 0) {
      errorMessage("No matching styles in the file");
      return;
    }

    // COLLECTIONS
    const collection = variableCollections.find((collection) => {
      return collection.name === parameters["collection-name"];
    });

    if (collection === undefined) {
      errorMessage("No matching collection found");
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

    // formal check
    if (teamVariable === undefined) {
      return;
    }

    const importedVariable = await figma.variables.importVariableByKeyAsync(
      teamVariable.key
    );

    allMatchedColorStyles.forEach(async (node: any) => {
      const fillsCopy = JSON.parse(JSON.stringify(node.fills));

      // console.log("fillsCopy", fillsCopy);
      // console.log("swappedStylesCount", swappedStylesCount);

      fillsCopy[0] = figma.variables.setBoundVariableForPaint(
        fillsCopy[0],
        "color",
        importedVariable
      );

      // console.log("fillsCopy", fillsCopy);
      // console.log("node", node.fills);

      swappedStylesCount++;

      node.fills = await fillsCopy;
    });

    // SUCCESS
    successMessage(
      `Swapped ${swappedStylesCount} from ${allMatchedColorStyles.length} styles! 🎉`
    );
  };
};

init();
